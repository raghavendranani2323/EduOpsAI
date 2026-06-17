import { NextRequest, NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";

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

    await withRls(user.id, async (tx) => {
      const existing = await tx.timetableSlot.findFirst({ where: { id, institutionId: institution.id } });
      if (existing) await tx.timetableSlot.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete timetable slot");
  }
}
