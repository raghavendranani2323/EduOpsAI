import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertClassAccess, assertRole } from "@/lib/auth/permissions";
import { writeAuditEvent } from "@/lib/audit/server";

const resultsSchema = z.object({
  results: z.array(z.object({
    studentId: z.string().min(1).max(191),
    subjectId: z.string().min(1).max(191),
    marksObtained: z.number().min(0).nullable(),
    grade: z.string().max(20).optional(),
    remarks: z.string().max(500).optional(),
  })).max(500),
});

// GET — fetch results for an exam (with student + subject info)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN", "TEACHER"], "EXAM_RESULTS_FORBIDDEN", "Exam results are not available for this role");
    const { id: examId } = await params;

    const results = await withRls(user.id, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { id: examId, institutionId: institution.id } });
      if (!exam) throw new ApiError(404, "EXAM_NOT_FOUND", "Exam not found");
      if (exam.classId) {
        await assertClassAccess(tx, {
          userId: user.id,
          institutionId: institution.id,
          role: membership.role,
          classId: exam.classId,
        });
      }

      const [subjects, students, existingResults] = await Promise.all([
        tx.subject.findMany({
          where: { institutionId: institution.id, ...(exam.classId ? { classId: exam.classId } : {}) },
          orderBy: { name: "asc" },
        }),
        tx.student.findMany({
          where: { institutionId: institution.id, status: "ACTIVE", ...(exam.classId ? { classId: exam.classId } : {}) },
          orderBy: [{ admissionNo: { sort: "asc", nulls: "last" } }, { fullName: "asc" }],
        }),
        tx.examResult.findMany({
          where: { examId, institutionId: institution.id },
        }),
      ]);

      return { exam, subjects, students, existingResults };
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load exam results");
  }
}

// POST — bulk upsert marks
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN", "TEACHER"], "MARKS_ENTRY_FORBIDDEN", "You cannot enter marks");
    const { id: examId } = await params;
    const parsed = resultsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_EXAM_RESULTS", parsed.error.issues[0]?.message ?? "Invalid marks");
    }
    const body = parsed.data;

    await withRls(user.id, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { id: examId, institutionId: institution.id } });
      if (!exam) throw new ApiError(404, "EXAM_NOT_FOUND", "Exam not found");
      if (!exam.classId) {
        throw new ApiError(400, "EXAM_CLASS_REQUIRED", "Exam must be assigned to a class before marks entry");
      }
      await assertClassAccess(tx, {
        userId: user.id,
        institutionId: institution.id,
        role: membership.role,
        classId: exam.classId,
      });

      const pairKeys = body.results.map((result) => `${result.studentId}:${result.subjectId}`);
      if (new Set(pairKeys).size !== pairKeys.length) {
        throw new ApiError(400, "DUPLICATE_EXAM_RESULT", "Duplicate student and subject result");
      }
      const studentIds = [...new Set(body.results.map((result) => result.studentId))];
      const subjectIds = [...new Set(body.results.map((result) => result.subjectId))];
      const [students, subjects] = await Promise.all([
        tx.student.findMany({
          where: {
            id: { in: studentIds },
            institutionId: institution.id,
            classId: exam.classId,
            status: "ACTIVE",
          },
          select: { id: true },
        }),
        tx.subject.findMany({
          where: {
            id: { in: subjectIds },
            institutionId: institution.id,
            OR: [{ classId: null }, { classId: exam.classId }],
          },
          select: { id: true },
        }),
      ]);
      if (students.length !== studentIds.length || subjects.length !== subjectIds.length) {
        throw new ApiError(400, "INVALID_EXAM_RESULT_SCOPE", "One or more students or subjects are not valid for this exam");
      }
      if (body.results.some((result) => result.marksObtained !== null && result.marksObtained > exam.totalMarks)) {
        throw new ApiError(400, "MARKS_EXCEED_TOTAL", "Marks cannot exceed total marks");
      }

      for (const r of body.results) {
        await tx.examResult.upsert({
          where: { examId_studentId_subjectId: { examId, studentId: r.studentId, subjectId: r.subjectId } },
          create: {
            institutionId: institution.id,
            examId,
            studentId:     r.studentId,
            subjectId:     r.subjectId,
            marksObtained: r.marksObtained,
            grade:         r.grade?.trim() || null,
            remarks:       r.remarks?.trim() || null,
          },
          update: {
            marksObtained: r.marksObtained,
            grade:         r.grade?.trim() || null,
            remarks:       r.remarks?.trim() || null,
          },
        });
      }
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "exam.results.save",
      targetId: examId,
      outcome: "success",
      meta: { resultCount: body.results.length },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to save exam results");
  }
}
