import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";

const schema = z.object({
  fullName:     z.string().min(2).max(120),
  phone:        z.string().min(10).max(20),
  email:        z.string().email().optional().or(z.literal("")),
  designation:  z.string().max(60).optional().or(z.literal("")),
  qualification:z.string().max(120).optional().or(z.literal("")),
  role:         z.enum(["ADMIN", "TEACHER", "ACCOUNTANT"]).default("TEACHER"),
  subjectIds:   z.array(z.string()).max(20).optional().default([]),
  newSubjects:  z.array(z.string().min(1).max(60)).max(20).optional().default([]),
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
  const symbols = "@#$%";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

export async function POST(req: Request) {
  const { institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Only owners and admins can add staff" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { fullName, phone, email, designation, qualification, role, subjectIds, newSubjects } = parsed.data;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ ok: false, error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const synthEmail = email && email.trim() ? email.trim().toLowerCase() : `${normalizedPhone.replace(/\D/g, "")}@staff.${institution.id.slice(0, 8)}.local`;
  const password   = randomPassword();
  const isSynthEmail = !email || !email.trim();

  const admin = createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Create Supabase auth user (idempotent: re-use if already exists)
  let authUserId: string;
  const created = await admin.auth.admin.createUser({
    email: synthEmail,
    password,
    email_confirm: true,
    phone: normalizedPhone,
    user_metadata: { fullName, designation, addedVia: "direct" },
  });

  if (created.error) {
    const msg = created.error.message ?? "";
    if (/already (been )?registered|already exists/i.test(msg)) {
      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list.data.users.find(u => u.email === synthEmail || (u.phone && `+${u.phone}` === normalizedPhone));
      if (!existing) {
        return NextResponse.json({ ok: false, error: "Auth user collision — manual cleanup needed" }, { status: 500 });
      }
      authUserId = existing.id;
    } else {
      return NextResponse.json({ ok: false, error: created.error.message }, { status: 500 });
    }
  } else {
    authUserId = created.data.user!.id;
  }

  // 2. Profile + membership + subjects in one transaction
  try {
    const member = await prismaAdmin.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { id: authUserId },
        create: {
          id: authUserId, fullName, phone: normalizedPhone,
          email: email?.trim() || null,
          designation: designation?.trim() || null,
          qualification: qualification?.trim() || null,
        },
        update: {
          fullName,
          phone: normalizedPhone,
          email: email?.trim() || null,
          designation: designation?.trim() || null,
          qualification: qualification?.trim() || null,
        },
      });

      const existingMembership = await tx.membership.findUnique({
        where: { userId_institutionId: { userId: authUserId, institutionId: institution.id } },
      });
      const m = existingMembership
        ? await tx.membership.update({
            where: { id: existingMembership.id },
            data: { role, revokedAt: null, acceptedAt: existingMembership.acceptedAt ?? new Date() },
          })
        : await tx.membership.create({
            data: {
              userId: authUserId, institutionId: institution.id, role,
              acceptedAt: new Date(),
            },
          });

      // Attach existing subjects
      if (subjectIds.length) {
        const valid = await tx.subject.findMany({
          where: { id: { in: subjectIds }, institutionId: institution.id },
          select: { id: true },
        });
        for (const s of valid) {
          await tx.teacherSubject.upsert({
            where: { profileId_subjectId: { profileId: authUserId, subjectId: s.id } },
            create: { profileId: authUserId, subjectId: s.id },
            update: {},
          });
        }
      }

      // Create + attach brand-new subjects
      for (const name of newSubjects) {
        const clean = name.trim();
        if (!clean) continue;
        const existing = await tx.subject.findFirst({ where: { institutionId: institution.id, name: clean } });
        const subj = existing ?? await tx.subject.create({ data: { institutionId: institution.id, name: clean } });
        await tx.teacherSubject.upsert({
          where: { profileId_subjectId: { profileId: authUserId, subjectId: subj.id } },
          create: { profileId: authUserId, subjectId: subj.id },
          update: {},
        });
      }

      return m;
    });

    return NextResponse.json({
      ok: true,
      staff: { id: authUserId, fullName, role: member.role, phone: normalizedPhone },
      credentials: {
        email: isSynthEmail ? null : synthEmail,
        password,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin}/login`,
        note: isSynthEmail
          ? "No email was provided. Share the password and ask the teacher to sign in using the phone number as their email after adding an email in profile."
          : null,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[staff/direct] DB failure", err);
    // Best-effort rollback of the auth user we just created
    if (created.data?.user) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to create staff" }, { status: 500 });
  }
}
