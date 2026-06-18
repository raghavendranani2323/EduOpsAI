import { NextRequest, NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertClassAccess, assertRole } from "@/lib/auth/permissions";
import { writeAuditEvent } from "@/lib/audit/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution, membership } = await requireApiInstitution();
    const body = await req.json();

    const notice = await withRls(user.id, async (tx) => {
      const existing = await tx.notice.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;
      if (membership.role === "TEACHER") {
        if (existing.authorId !== user.id || existing.audience !== "CLASS" || !existing.classId) {
          throw new ApiError(403, "NOTICE_UPDATE_FORBIDDEN", "You can update only your assigned-class notices");
        }
        await assertClassAccess(tx, {
          userId: user.id,
          institutionId: institution.id,
          role: membership.role,
          classId: existing.classId,
        });
      } else {
        assertRole(membership.role, ["OWNER", "ADMIN"], "NOTICE_UPDATE_FORBIDDEN", "You cannot update notices");
      }
      return tx.notice.update({
        where: { id },
        data: {
          ...(body.title    !== undefined ? { title: body.title } : {}),
          ...(body.body     !== undefined ? { body: body.body } : {}),
          ...(body.audience !== undefined ? { audience: body.audience } : {}),
          ...(body.classId  !== undefined ? { classId: body.classId || null } : {}),
          ...(body.pinned   !== undefined ? { pinned: body.pinned } : {}),
          ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
        },
      });
    });

    if (!notice) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "notice.update",
      targetId: id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true, notice });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to update notice");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution, membership } = await requireApiInstitution();

    await withRls(user.id, async (tx) => {
      const existing = await tx.notice.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return;
      if (membership.role === "TEACHER") {
        if (existing.authorId !== user.id || existing.audience !== "CLASS" || !existing.classId) {
          throw new ApiError(403, "NOTICE_DELETE_FORBIDDEN", "You can delete only your assigned-class notices");
        }
        await assertClassAccess(tx, {
          userId: user.id,
          institutionId: institution.id,
          role: membership.role,
          classId: existing.classId,
        });
      } else {
        assertRole(membership.role, ["OWNER", "ADMIN"], "NOTICE_DELETE_FORBIDDEN", "You cannot delete notices");
      }
      await tx.notice.delete({ where: { id } });
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "notice.delete",
      targetId: id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete notice");
  }
}
