import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import { withRls } from "@/lib/prisma/rls";
import { whatsappLink } from "@/lib/format/phone";
import {
  createParentToken,
  isParentTokenActive,
  parentTokenExpiry,
  recordParentAccessEvent,
} from "@/lib/parent/access";
import { writeAuditEvent } from "@/lib/audit/server";

const actionSchema = z.object({
  action: z.enum(["GENERATE", "ROTATE"]).default("GENERATE"),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "PARENT_ACCESS_FORBIDDEN", "Only owners and admins can manage parent access");
    const { id } = await ctx.params;
    const result = await withRls(user.id, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id, institutionId: institution.id },
        select: {
          id: true,
          portalToken: true,
          portalTokenCreatedAt: true,
          portalTokenExpiresAt: true,
          portalTokenRevokedAt: true,
        },
      });
      if (!student) throw new ApiError(404, "STUDENT_NOT_FOUND", "Student not found");
      const events = await tx.parentAccessEvent.findMany({
        where: { institutionId: institution.id, studentId: id },
        orderBy: { createdAt: "desc" },
        take: 25,
      });
      return {
        active: isParentTokenActive(student),
        expiresAt: student.portalTokenExpiresAt,
        revokedAt: student.portalTokenRevokedAt,
        events,
      };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load parent access");
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "PARENT_ACCESS_FORBIDDEN", "Only owners and admins can manage parent access");
    const { id } = await ctx.params;
    const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError(400, "INVALID_PARENT_ACCESS_ACTION", "Invalid parent access action");

    const result = await withRls(user.id, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id, institutionId: institution.id, status: "ACTIVE" },
        include: {
          guardians: {
            where: { isPrimary: true },
            take: 1,
            include: { guardian: { select: { fullName: true, phone: true } } },
          },
        },
      });
      if (!student) throw new ApiError(404, "STUDENT_NOT_FOUND", "Active student not found");

      const rotate = parsed.data.action === "ROTATE";
      const active = isParentTokenActive(student);
      const token = active && !rotate ? student.portalToken! : createParentToken();
      const now = new Date();
      const expiresAt = active && !rotate ? student.portalTokenExpiresAt! : parentTokenExpiry(now);

      if (!active || rotate) {
        await tx.student.update({
          where: { id },
          data: {
            portalToken: token,
            portalTokenCreatedAt: now,
            portalTokenExpiresAt: expiresAt,
            portalTokenRevokedAt: null,
          },
        });
        await recordParentAccessEvent(tx, {
          institutionId: institution.id,
          studentId: id,
          actorUserId: user.id,
          action: rotate ? "ROTATED" : "GENERATED",
          meta: { expiresAt: expiresAt.toISOString() },
        });
      }
      return { student, token, expiresAt, rotated: rotate };
    });

    const origin = new URL(req.url).origin;
    const url = `${origin}/p/${result.token}`;
    const guardian = result.student.guardians[0]?.guardian;
    const greeting = guardian?.fullName ? `Dear ${guardian.fullName}` : "Dear Parent";
    const body = `${greeting}, this private link gives temporary access to ${result.student.fullName}'s school updates until ${result.expiresAt.toLocaleDateString("en-IN")}: ${url}. Do not forward it. — ${institution.name}`;
    const shareLink = guardian?.phone ? whatsappLink(guardian.phone, body) : null;

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: result.rotated ? "parentAccess.rotate" : "parentAccess.generate",
      targetId: id,
      outcome: "success",
      meta: { expiresAt: result.expiresAt.toISOString() },
    });
    return NextResponse.json({
      ok: true,
      url,
      shareLink,
      expiresAt: result.expiresAt,
      guardianPhone: guardian?.phone ?? null,
      guardianName: guardian?.fullName ?? null,
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to manage parent access");
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "PARENT_ACCESS_FORBIDDEN", "Only owners and admins can manage parent access");
    const { id } = await ctx.params;
    await withRls(user.id, async (tx) => {
      const changed = await tx.student.updateMany({
        where: { id, institutionId: institution.id, portalToken: { not: null } },
        data: { portalToken: null, portalTokenRevokedAt: new Date() },
      });
      if (changed.count === 0) throw new ApiError(404, "PARENT_ACCESS_NOT_FOUND", "Active parent link not found");
      await recordParentAccessEvent(tx, {
        institutionId: institution.id,
        studentId: id,
        actorUserId: user.id,
        action: "REVOKED",
      });
    });
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "parentAccess.revoke",
      targetId: id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to revoke parent access");
  }
}
