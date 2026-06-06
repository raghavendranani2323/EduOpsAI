import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

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

  const invitation = await withRls(user.id, async (tx) => {
    const existingInvite = await tx.invitation.findFirst({
      where: {
        institutionId: institution.id,
        email: parsed.data.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) throw new Error("PENDING");

    return tx.invitation.create({
      data: {
        institutionId: institution.id,
        email: parsed.data.email,
        role: parsed.data.role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }).catch((e: Error) => {
    if (e.message === "PENDING") return null;
    throw e;
  });

  if (!invitation) {
    return NextResponse.json({ ok: false, error: "An invitation for this email is already pending" }, { status: 409 });
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/accept-invite/${invitation.token}`;

  return NextResponse.json({
    ok: true,
    invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
    inviteUrl,
  });
}

// GET /api/invitations — list pending invitations
export async function GET() {
  const { user, institution } = await requireInstitution();
  const invitations = await withRls(user.id, (tx) =>
    tx.invitation.findMany({
      where: { institutionId: institution.id, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    })
  );
  return NextResponse.json({ ok: true, invitations });
}
