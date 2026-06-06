import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prismaAdmin as prisma } from "@/lib/prisma/admin";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please log in or sign up first" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token: parsed.data.token },
  });

  if (!invitation) {
    return NextResponse.json({ ok: false, error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.acceptedAt) {
    return NextResponse.json({ ok: false, error: "Invitation already accepted" }, { status: 410 });
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "Invitation has expired" }, { status: 410 });
  }
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({
      ok: false,
      error: `This invitation is for ${invitation.email}. Please log in with that email.`,
    }, { status: 403 });
  }

  // Ensure profile
  await prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      fullName: user.user_metadata?.full_name ?? user.email ?? "User",
    },
    update: {},
  });

  // Don't overwrite an existing higher role with a lower one from an invitation
  const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, ACCOUNTANT: 2, TEACHER: 1 };
  const existing = await prisma.membership.findUnique({
    where: { userId_institutionId: { userId: user.id, institutionId: invitation.institutionId } },
  });

  const finalRole = existing && ROLE_RANK[existing.role] > ROLE_RANK[invitation.role]
    ? existing.role
    : invitation.role;

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_institutionId: { userId: user.id, institutionId: invitation.institutionId } },
      create: {
        userId: user.id,
        institutionId: invitation.institutionId,
        role: invitation.role,
        acceptedAt: new Date(),
        invitedBy: null,
      },
      update: {
        role: finalRole,
        revokedAt: null,
        acceptedAt: new Date(),
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  const response = NextResponse.json({ ok: true, institutionId: invitation.institutionId });
  response.cookies.set("eduops_institution_id", invitation.institutionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
