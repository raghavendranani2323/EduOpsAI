import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

// GET — fetch results for an exam (with student + subject info)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id: examId } = await params;

    const results = await withRls(user.id, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { id: examId, institutionId: institution.id } });
      if (!exam) throw new Error("Exam not found");

      const [subjects, students, existingResults] = await Promise.all([
        tx.subject.findMany({
          where: { institutionId: institution.id, ...(exam.classId ? { classId: exam.classId } : {}) },
          orderBy: { name: "asc" },
        }),
        tx.student.findMany({
          where: { institutionId: institution.id, status: "ACTIVE", ...(exam.classId ? { classId: exam.classId } : {}) },
          orderBy: { fullName: "asc" },
        }),
        tx.examResult.findMany({
          where: { examId, institutionId: institution.id },
        }),
      ]);

      return { exam, subjects, students, existingResults };
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// POST — bulk upsert marks
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id: examId } = await params;
    const body = await req.json() as {
      results: { studentId: string; subjectId: string; marksObtained: number | null; grade?: string; remarks?: string }[];
    };

    await withRls(user.id, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { id: examId, institutionId: institution.id } });
      if (!exam) throw new Error("Exam not found");

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

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
