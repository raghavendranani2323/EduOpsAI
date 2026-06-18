import { NextRequest, NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertClassAccess, assertRole, authorizedClassIds } from "@/lib/auth/permissions";
import { assertTimetableReferencesAndAvailability } from "@/lib/data-integrity/validation";
import { writeAuditEvent } from "@/lib/audit/server";

export async function GET(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const slots = await withRls(user.id, async (tx) => {
      const ids = await authorizedClassIds(tx, user.id, institution.id, membership.role);
      if (classId) {
        await assertClassAccess(tx, { userId: user.id, institutionId: institution.id, role: membership.role, classId });
      }
      return tx.timetableSlot.findMany({
        where: {
          institutionId: institution.id,
          ...(classId
            ? { classId }
            : ids !== null
              ? { classId: { in: ids.length ? ids : ["__none__"] } }
              : {}),
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    });

    return NextResponse.json({ ok: true, slots });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load timetable");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "TIMETABLE_CREATE_FORBIDDEN", "Only owners and admins can edit the timetable");
    const body = await req.json();
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, label } = body;

    if (!classId || !dayOfWeek || !startTime || !endTime) {
      return NextResponse.json({ ok: false, error: "classId, dayOfWeek, startTime, endTime required" }, { status: 400 });
    }

    const slot = await withRls(user.id, async (tx) => {
      const normalizedDay = Number(dayOfWeek);
      await assertTimetableReferencesAndAvailability(tx, {
        institutionId: institution.id,
        classId,
        subjectId: subjectId || null,
        teacherId: teacherId || null,
        dayOfWeek: normalizedDay,
        startTime,
        endTime,
      });
      return tx.timetableSlot.create({
        data: {
          institutionId: institution.id,
          classId,
          subjectId: subjectId || null,
          teacherId: teacherId || null,
          dayOfWeek: normalizedDay,
          startTime,
          endTime,
          label: label || null,
        },
      });
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "timetable.create",
      targetId: slot.id,
      outcome: "success",
      meta: { classId: slot.classId, dayOfWeek: slot.dayOfWeek },
    });
    return NextResponse.json({ ok: true, slot });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to create timetable slot");
  }
}
