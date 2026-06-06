import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { prisma } from "@/lib/prisma/client";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "TEACHER", "ACCOUNTANT"]),
});

// POST /api/invitations — create an invitation
export async function POST(req: NextRequest) {
  const { user, institution, membership } = await requireInstitution();

  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Only owners and admins can invite" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  // Block self-invite + duplicate-email check
  const existingMember = await prisma.membership.findFirst({
    where: {
      institutionId: institution.id,
      user: { id: user.id },
    },
  });

  const existingInvite = await prisma.invitation.findFirst({
    where: {
      institutionId: institution.id,
      email: parsed.data.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) {
    return NextResponse.json({ ok: false, error: "An invitation for this email is already pending" }, { status: 409 });
  }

  const invitation = await prisma.invitation.create({
    data: {
      institutionId: institution.id,
      email: parsed.data.email,
      role: parsed.data.role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/accept-invite/${invitation.token}`;

  return NextResponse.json({
    ok: true,
    invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
    inviteUrl,
  });
}

// GET /api/invitations — list pending invitations
export async function GET() {
  const { institution } = await requireInstitution();
  const invitations = await prisma.invitation.findMany({
    where: { institutionId: institution.id, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, invitations });
}
