import { NextRequest, NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import { assertTimetableReferencesAndAvailability } from "@/lib/data-integrity/validation";
import { writeAuditEvent } from "@/lib/audit/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "TIMETABLE_UPDATE_FORBIDDEN", "Only owners and admins can edit the timetable");
    const body = await req.json();
    const { subjectId, teacherId, dayOfWeek, startTime, endTime, label } = body;

    const slot = await withRls(user.id, async (tx) => {
      const existing = await tx.timetableSlot.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;
      const next = {
        subjectId: subjectId !== undefined ? subjectId || null : existing.subjectId,
        teacherId: teacherId !== undefined ? teacherId || null : existing.teacherId,
        dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : existing.dayOfWeek,
        startTime: startTime !== undefined ? startTime : existing.startTime,
        endTime: endTime !== undefined ? endTime : existing.endTime,
      };
      await assertTimetableReferencesAndAvailability(tx, {
        institutionId: institution.id,
        classId: existing.classId,
        ...next,
        excludeSlotId: id,
      });
      return tx.timetableSlot.update({
        where: { id },
        data: {
          ...(subjectId !== undefined ? { subjectId: subjectId || null } : {}),
          ...(teacherId !== undefined ? { teacherId: teacherId || null } : {}),
          ...(dayOfWeek !== undefined ? { dayOfWeek: Number(dayOfWeek) } : {}),
          ...(startTime !== undefined ? { startTime } : {}),
          ...(endTime !== undefined ? { endTime } : {}),
          ...(label !== undefined ? { label: label || null } : {}),
        },
      });
    });

    if (!slot) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "timetable.update",
      targetId: id,
      outcome: "success",
      meta: { classId: slot.classId, dayOfWeek: slot.dayOfWeek },
    });
    return NextResponse.json({ ok: true, slot });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to update timetable slot");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "TIMETABLE_DELETE_FORBIDDEN", "Only owners and admins can edit the timetable");

    const deleted = await withRls(user.id, async (tx) => {
      const existing = await tx.timetableSlot.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;
      await tx.timetableSlot.delete({ where: { id } });
      return existing;
    });

    if (!deleted) throw new ApiError(404, "TIMETABLE_NOT_FOUND", "Timetable slot not found");
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "timetable.delete",
      targetId: id,
      outcome: "success",
      meta: { classId: deleted.classId, dayOfWeek: deleted.dayOfWeek },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete timetable slot");
  }
}
