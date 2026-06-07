import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";

const schema = z.object({
  fullName:      z.string().min(2).max(120),
  phone:         z.string().min(10).max(20),
  email:         z.string().email().optional().or(z.literal("")),
  designation:   z.string().max(60).optional().or(z.literal("")),
  qualification: z.string().max(120).optional().or(z.literal("")),
  role:          z.enum(["ADMIN", "TEACHER", "ACCOUNTANT"]).default("TEACHER"),
  subjectIds:    z.array(z.string()).max(20).optional().default([]),
  newSubjects:   z.array(z.string().min(1).max(60)).max(20).optional().default([]),
});

function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && raw.startsWith("+")) return raw;
  if (raw.startsWith("+") && digits.length >= 10) return raw;
  return null;
}

function randomPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 9; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

// Targeted lookup against auth.users — replaces the listUsers({perPage:1000}) scan
// from D2 that risked cross-tenant data exposure and was O(N) per call.
async function findExistingAuthUser(email: string | null, phone: string): Promise<string | null> {
  type Row = { id: string };
  const rows = await prismaAdmin.$queryRawUnsafe<Row[]>(
    `SELECT id::text FROM auth.users
     WHERE (email = $1 AND $1 IS NOT NULL)
        OR phone = $2
     LIMIT 1`,
    email,
    phone.replace(/^\+/, ""),
  );
  return rows[0]?.id ?? null;
}

async function writeAuditLog(actorId: string, action: string, targetId: string, meta: Record<string, unknown>) {
  try {
    await prismaAdmin.auditLog.create({
      data: {
        actorUserId:   actorId,
        institutionId: (meta.institutionId as string) ?? null,
        action,
        targetId,
        meta: JSON.parse(JSON.stringify(meta)),
      },
    });
  } catch (e) {
    console.error("[audit] write failed", e);
  }
}

export async function POST(req: Request) {
  const { user, institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Only owners and admins can add staff" }, { status: 403 });
  }

  // Rate limit: max 10 staff creations per admin per hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prismaAdmin.auditLog.count({
    where: {
      actorUserId: user.id,
      action: { in: ["staff.create", "staff.reactivate"] },
      createdAt: { gte: hourAgo },
    },
  }).catch(() => 0);
  if (recentCount >= 10) {
    return NextResponse.json({
      ok: false,
      error: "Rate limit reached: max 10 staff creations per hour. Try again in a few minutes.",
    }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { fullName, phone, email: rawEmail, designation, qualification, role, subjectIds, newSubjects } = parsed.data;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ ok: false, error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
  }

  const email = rawEmail?.trim().toLowerCase() || null;

  // Email is required for ADMIN / ACCOUNTANT — they sign in via the standard email login.
  // TEACHERs can use phone+password via /teacher-login.
  if ((role === "ADMIN" || role === "ACCOUNTANT") && !email) {
    return NextResponse.json({
      ok: false,
      error: "Email is required for admins and accountants. Use TEACHER role for phone-only login.",
    }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const password = randomPassword();
  const admin = createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Decide auth identifier
  const useEmailAuth = !!email;
  const origin = new URL(req.url).origin;
  const loginMode: "email" | "phone" = useEmailAuth ? "email" : "phone";

  let authUserId: string | null = null;
  let createdNew = false;

  // 1. Look up existing auth user (idempotent re-add)
  const existingId = await findExistingAuthUser(email, normalizedPhone);

  if (existingId) {
    authUserId = existingId;
    // Reset password so the admin can give the teacher fresh credentials
    const updated = await admin.auth.admin.updateUserById(existingId, {
      password,
      ...(email ? { email, email_confirm: true } : {}),
      phone: normalizedPhone.replace(/^\+/, ""),
      phone_confirm: true,
      user_metadata: { fullName, designation, role, lastResetVia: "direct-staff" },
    });
    if (updated.error) {
      return NextResponse.json({ ok: false, error: updated.error.message }, { status: 500 });
    }
  } else {
    // 2. Create new auth user (email OR phone identifier, never both fake)
    const createPayload = useEmailAuth
      ? {
          email: email!,
          password,
          email_confirm: true,
          phone: normalizedPhone,
          phone_confirm: true,
          user_metadata: { fullName, designation, role, addedVia: "direct-staff" },
        }
      : {
          phone: normalizedPhone,
          password,
          phone_confirm: true,
          user_metadata: { fullName, designation, role, addedVia: "direct-staff" },
        };

    const created = await admin.auth.admin.createUser(createPayload);
    if (created.error || !created.data.user) {
      return NextResponse.json({ ok: false, error: created.error?.message ?? "Auth create failed" }, { status: 500 });
    }
    authUserId = created.data.user.id;
    createdNew = true;
  }

  // 3. Persist Profile + Membership + Subjects in one transaction
  try {
    const member = await prismaAdmin.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { id: authUserId! },
        create: {
          id: authUserId!, fullName, phone: normalizedPhone,
          email: email ?? null,
          designation: designation?.trim() || null,
          qualification: qualification?.trim() || null,
        },
        update: {
          fullName,
          phone: normalizedPhone,
          email: email ?? null,
          designation: designation?.trim() || null,
          qualification: qualification?.trim() || null,
        },
      });

      const existingMembership = await tx.membership.findUnique({
        where: { userId_institutionId: { userId: authUserId!, institutionId: institution.id } },
      });
      const m = existingMembership
        ? await tx.membership.update({
            where: { id: existingMembership.id },
            data: { role, revokedAt: null, acceptedAt: existingMembership.acceptedAt ?? new Date() },
          })
        : await tx.membership.create({
            data: { userId: authUserId!, institutionId: institution.id, role, acceptedAt: new Date() },
          });

      if (subjectIds.length) {
        const valid = await tx.subject.findMany({
          where: { id: { in: subjectIds }, institutionId: institution.id },
          select: { id: true },
        });
        for (const s of valid) {
          await tx.teacherSubject.upsert({
            where: { profileId_subjectId: { profileId: authUserId!, subjectId: s.id } },
            create: { profileId: authUserId!, subjectId: s.id },
            update: {},
          });
        }
      }

      for (const name of newSubjects) {
        const clean = name.trim();
        if (!clean) continue;
        const existing = await tx.subject.findFirst({ where: { institutionId: institution.id, name: clean } });
        const subj = existing ?? await tx.subject.create({ data: { institutionId: institution.id, name: clean } });
        await tx.teacherSubject.upsert({
          where: { profileId_subjectId: { profileId: authUserId!, subjectId: subj.id } },
          create: { profileId: authUserId!, subjectId: subj.id },
          update: {},
        });
      }

      return m;
    });

    await writeAuditLog(user.id, createdNew ? "staff.create" : "staff.reactivate", authUserId!, {
      institutionId: institution.id,
      role,
      loginMode,
      hasEmail: !!email,
      fullName,
    });

    return NextResponse.json({
      ok: true,
      staff: { id: authUserId, fullName, role: member.role, phone: normalizedPhone, email },
      credentials: {
        mode: loginMode,
        identifier: loginMode === "email" ? email : normalizedPhone,
        password,
        loginUrl: loginMode === "email"
          ? `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/login`
          : `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/teacher-login`,
        whatsappShare:
          loginMode === "email"
            ? `Hi ${fullName.split(" ")[0]}, your EduOps login:\nEmail: ${email}\nPassword: ${password}\nLogin: ${process.env.NEXT_PUBLIC_APP_URL ?? origin}/login`
            : `Hi ${fullName.split(" ")[0]}, your EduOps login:\nPhone: ${normalizedPhone}\nPassword: ${password}\nLogin: ${process.env.NEXT_PUBLIC_APP_URL ?? origin}/teacher-login`,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[staff/direct] DB failure", err);
    if (createdNew && authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to create staff" }, { status: 500 });
  }
}
