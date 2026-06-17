import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";
import { withRls } from "@/lib/prisma/rls";
import { requireApiInstitution } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "TEACHER", "ACCOUNTANT"]),
});

function inviteToken() {
  return randomBytes(32).toString("base64url");
}

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req);
  try {
    const { user, institution, membership } = await requireApiInstitution();
    await enforceRateLimit({
      scope: "staff-invite",
      subject: `${institution.id}:${user.id}`,
      limit: 20,
      windowSeconds: 60 * 60,
    });
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      await writeAuditEvent({
        actorUserId: user.id,
        institutionId: institution.id,
        action: "staff.invite",
        outcome: "denied",
        meta: { role: membership.role },
      });
      throw new ApiError(403, "STAFF_INVITE_FORBIDDEN", "Only owners and admins can invite staff");
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_INVITATION", parsed.error.issues[0]?.message ?? "Invalid invitation");
    }

    const email = parsed.data.email.trim().toLowerCase();
    const invitation = await withRls(user.id, async (tx) => {
      const existingInvite = await tx.invitation.findFirst({
        where: {
          institutionId: institution.id,
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (existingInvite) {
        throw new ApiError(409, "INVITATION_PENDING", "An invitation for this email is already pending");
      }

      return tx.invitation.create({
        data: {
          institutionId: institution.id,
          email,
          role: parsed.data.role,
          token: inviteToken(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin}/accept-invite/${invitation.token}`;
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.invite",
      targetId: invitation.id,
      outcome: "success",
      meta: { role: invitation.role, emailDomain: invitation.email.split("@")[1] ?? null },
    });

    return NextResponse.json({
      ok: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      inviteUrl,
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, { requestId });
    logServer("error", "staff.invite.failed", { requestId, error: err });
    return serverErrorResponse("Failed to create invitation", { requestId });
  }
}

export async function GET() {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new ApiError(403, "INVITATION_LIST_FORBIDDEN", "Only owners and admins can view invitations");
    }

    const invitations = await withRls(user.id, (tx) =>
      tx.invitation.findMany({
        where: { institutionId: institution.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      })
    );
    return NextResponse.json({ ok: true, invitations });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load invitations");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new ApiError(403, "INVITATION_REVOKE_FORBIDDEN", "Only owners and admins can revoke invitations");
    }

    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ApiError(400, "INVITATION_ID_REQUIRED", "Invitation id is required");

    const deleted = await withRls(user.id, (tx) =>
      tx.invitation.deleteMany({
        where: { id, institutionId: institution.id, acceptedAt: null },
      })
    );
    if (deleted.count === 0) {
      throw new ApiError(404, "INVITATION_NOT_FOUND", "Pending invitation not found");
    }

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.invite.revoke",
      targetId: id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    console.error("[invitations] revoke failed", err instanceof Error ? err.message : err);
    return serverErrorResponse("Failed to revoke invitation");
  }
}
