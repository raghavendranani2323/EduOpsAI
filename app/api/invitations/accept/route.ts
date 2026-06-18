import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";
import { prismaAdmin as prisma } from "@/lib/prisma/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";

const schema = z.object({ token: z.string().min(32).max(256) });
const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, ACCOUNTANT: 2, TEACHER: 1 };

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please log in or sign up first", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  let institutionId: string | null = null;
  let invitationId: string | null = null;
  try {
    await enforceRateLimit({
      scope: "staff-invite-accept",
      subject: user.id,
      limit: 20,
      windowSeconds: 60 * 60,
    });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_INVITATION", "Invalid invitation");
    }

    const accepted = await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { token: parsed.data.token },
      });
      if (!invitation) throw new ApiError(404, "INVITATION_NOT_FOUND", "Invitation not found");
      institutionId = invitation.institutionId;
      invitationId = invitation.id;

      const now = new Date();
      if (invitation.acceptedAt) {
        throw new ApiError(410, "INVITATION_ALREADY_USED", "Invitation has already been used");
      }
      if (invitation.expiresAt <= now) {
        throw new ApiError(410, "INVITATION_EXPIRED", "Invitation has expired");
      }
      if (!user.email || invitation.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new ApiError(403, "INVITATION_ACCOUNT_MISMATCH", "Log in with the account that received this invitation");
      }

      const consumed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          expiresAt: { gt: now },
        },
        data: { acceptedAt: now },
      });
      if (consumed.count !== 1) {
        throw new ApiError(410, "INVITATION_ALREADY_USED", "Invitation is no longer available");
      }

      await tx.profile.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          fullName: invitation.fullName ?? user.user_metadata?.full_name ?? user.email ?? "User",
          phone: invitation.phone,
          email: user.email,
          designation: invitation.designation,
          qualification: invitation.qualification,
        },
        update: {
          email: user.email,
          ...(invitation.fullName ? { fullName: invitation.fullName } : {}),
          ...(invitation.phone ? { phone: invitation.phone } : {}),
          ...(invitation.designation ? { designation: invitation.designation } : {}),
          ...(invitation.qualification ? { qualification: invitation.qualification } : {}),
        },
      });

      const existing = await tx.membership.findUnique({
        where: { userId_institutionId: { userId: user.id, institutionId: invitation.institutionId } },
      });
      const finalRole = existing && ROLE_RANK[existing.role] > ROLE_RANK[invitation.role]
        ? existing.role
        : invitation.role;

      await tx.membership.upsert({
        where: { userId_institutionId: { userId: user.id, institutionId: invitation.institutionId } },
        create: {
          userId: user.id,
          institutionId: invitation.institutionId,
          role: invitation.role,
          acceptedAt: now,
          invitedBy: null,
        },
        update: {
          role: finalRole,
          revokedAt: null,
          acceptedAt: now,
        },
      });

      return { institutionId: invitation.institutionId, invitationId: invitation.id, role: finalRole };
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: accepted.institutionId,
      action: "staff.invite.accept",
      targetId: accepted.invitationId,
      outcome: "success",
      meta: { role: accepted.role },
    });

    const response = NextResponse.json({ ok: true, institutionId: accepted.institutionId });
    response.cookies.set("eduops_institution_id", accepted.institutionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      if (institutionId) {
        await writeAuditEvent({
          actorUserId: user.id,
          institutionId,
          action: "staff.invite.accept",
          targetId: invitationId,
          outcome: "denied",
          meta: { code: err.code },
        });
      }
      return errorResponse(err, { requestId });
    }
    logServer("error", "staff.invite.accept_failed", { requestId, error: err, institutionId });
    return serverErrorResponse("Failed to accept invitation", { requestId });
  }
}
