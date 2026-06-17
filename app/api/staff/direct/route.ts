import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { normalizeIndianPhone } from "@/lib/staff/helpers";
import { writeAuditEvent } from "@/lib/audit/server";
import { serverErrorResponse } from "@/lib/api/errors";

const schema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(10).max(20),
  email: z.string().email(),
  designation: z.string().max(60).optional().or(z.literal("")),
  qualification: z.string().max(120).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "TEACHER", "ACCOUNTANT"]).default("TEACHER"),
}).strict();

function inviteToken() {
  return randomBytes(32).toString("base64url");
}

export async function POST(req: Request) {
  const { user, institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.invite",
      outcome: "denied",
      meta: { role: membership.role },
    });
    return NextResponse.json({ ok: false, error: "Only owners and admins can invite staff" }, { status: 403 });
  }

  const recentCount = await prismaAdmin.auditLog.count({
    where: {
      actorUserId: user.id,
      action: "staff.invite",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  }).catch(() => 0);
  if (recentCount >= 20) {
    return NextResponse.json({
      ok: false,
      error: "Rate limit reached: max 20 staff invitations per hour. Try again in a few minutes.",
    }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { fullName, phone, email: rawEmail, role, designation, qualification } = parsed.data;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ ok: false, error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
  }
  const email = rawEmail.trim().toLowerCase();

  try {
    const existingMember = await prismaAdmin.membership.findFirst({
      where: {
        institutionId: institution.id,
        user: { email },
      },
      select: { userId: true, role: true, revokedAt: true },
    });
    if (existingMember && !existingMember.revokedAt) {
      return NextResponse.json({ ok: false, error: "This staff member is already active in your institution" }, { status: 409 });
    }

    const pending = await prismaAdmin.invitation.findFirst({
      where: {
        institutionId: institution.id,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (pending) {
      return NextResponse.json({ ok: false, error: "An invitation for this email is already pending" }, { status: 409 });
    }

    const invitation = await prismaAdmin.invitation.create({
      data: {
        institutionId: institution.id,
        email,
        fullName,
        phone: normalizedPhone,
        designation: designation || null,
        qualification: qualification || null,
        role,
        token: inviteToken(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, role: true, token: true, expiresAt: true },
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.invite",
      targetId: invitation.id,
      outcome: "success",
      meta: {
        role,
        hasPhone: true,
        emailDomain: email.split("@")[1] ?? null,
      },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const inviteUrl = `${origin}/accept-invite/${invitation.token}`;

    return NextResponse.json({
      ok: true,
      invited: true,
      staff: { id: invitation.id, fullName, role, phone: normalizedPhone, email },
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      inviteUrl,
      whatsappShare: `Hi ${fullName.split(" ")[0]}, ${institution.name} has invited you to EduOps. Please open this secure invitation link to set up your login: ${inviteUrl}`,
    }, { status: 201 });
  } catch (err) {
    console.error("[staff/direct] invite failed", err instanceof Error ? err.message : err);
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.invite",
      outcome: "failure",
      meta: { role },
    });
    return serverErrorResponse("Failed to invite staff");
  }
}
