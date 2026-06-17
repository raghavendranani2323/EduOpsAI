import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertClassAccess, assertRole } from "@/lib/auth/permissions";
import {
  assertAdmissionNoAvailable,
  assertStudentClass,
  normalizeAdmissionNo,
} from "@/lib/data-integrity/validation";
import { writeAuditEvent } from "@/lib/audit/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN", "TEACHER"], "STUDENT_ACCESS_FORBIDDEN", "Student details are not available for this role");
    const { id } = await params;

    const student = await withRls(user.id, async (tx) => {
      const row = await tx.student.findFirst({
        where: { id, institutionId: institution.id },
        include: {
          class: { select: { id: true, name: true } },
          studentTags: { include: { tag: true } },
          guardians: { include: { guardian: true } },
          invoices: {
            orderBy: { dueDate: "desc" },
            take: 10,
            select: { id: true, status: true, amountDue: true, amountPaid: true, dueDate: true, periodStart: true, periodEnd: true },
          },
        },
      });
      if (row?.classId && membership.role === "TEACHER") {
        await assertClassAccess(tx, {
          userId: user.id,
          institutionId: institution.id,
          role: membership.role,
          classId: row.classId,
        });
      }
      return row;
    });

    if (!student) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const responseStudent = membership.role === "TEACHER"
      ? { ...student, invoices: [] }
      : student;
    return NextResponse.json({ ok: true, student: responseStudent });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load student");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "STUDENT_UPDATE_FORBIDDEN", "Only owners and admins can update students");
    const { id } = await params;
    const body = await req.json() as {
      fullName?: string;
      admissionNo?: string;
      gender?: string;
      dob?: string;
      classId?: string | null;
      status?: string;
      tagIds?: string[];
    };

    await withRls(user.id, async (tx) => {
      const existing = await tx.student.findFirst({
        where: { id, institutionId: institution.id },
        select: { id: true },
      });
      if (!existing) throw new ApiError(404, "STUDENT_NOT_FOUND", "Student not found");

      const admissionNo = body.admissionNo !== undefined
        ? normalizeAdmissionNo(body.admissionNo)
        : undefined;
      await Promise.all([
        admissionNo !== undefined
          ? assertAdmissionNoAvailable(tx, institution.id, admissionNo, id)
          : Promise.resolve(),
        body.classId !== undefined
          ? assertStudentClass(tx, institution.id, body.classId)
          : Promise.resolve(),
      ]);

      await tx.student.update({
        where: { id },
        data: {
          ...(body.fullName   !== undefined ? { fullName: body.fullName.trim() }    : {}),
          ...(admissionNo !== undefined ? { admissionNo } : {}),
          ...(body.gender     !== undefined ? { gender: body.gender as "MALE" | "FEMALE" | "OTHER" | null } : {}),
          ...(body.dob        !== undefined ? { dob: body.dob ? new Date(body.dob) : null } : {}),
          ...(body.classId    !== undefined ? { classId: body.classId }             : {}),
          ...(body.status     !== undefined ? { status: body.status as "ACTIVE" | "ARCHIVED" } : {}),
        },
      });

      if (body.tagIds !== undefined) {
        await tx.studentTag.deleteMany({ where: { studentId: id } });
        if (body.tagIds.length > 0) {
          await tx.studentTag.createMany({
            data: body.tagIds.map(tagId => ({ studentId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "student.update",
      targetId: id,
      outcome: "success",
      meta: {
        changedFields: Object.keys(body).filter((key) => key !== "tagIds"),
        tagsChanged: body.tagIds !== undefined,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to update student");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "STUDENT_DELETE_FORBIDDEN", "Only owners and admins can delete students");
    const { id } = await params;

    const archived = await withRls(user.id, (tx) =>
      tx.student.updateMany({
        where: { id, institutionId: institution.id },
        data: { status: "ARCHIVED", archivedAt: new Date(), classId: null },
      })
    );
    if (archived.count === 0) {
      throw new ApiError(404, "STUDENT_NOT_FOUND", "Student not found");
    }

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "student.archive",
      targetId: id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete student");
  }
}
