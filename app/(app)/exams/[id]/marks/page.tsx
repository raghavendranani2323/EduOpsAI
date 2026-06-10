import { notFound } from "next/navigation";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { MarksClient } from "./marks-client";
import type { Subject, Student, ExamResult } from "@prisma/client";

export default async function MarksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = await params;
  const { user, institution } = await requireInstitution();

  const data = await withRls(user.id, async (tx) => {
    const exam = await tx.exam.findFirst({
      where: { id: examId, institutionId: institution.id },
      include: { class: { select: { name: true } } },
    });
    if (!exam) return null;

    const [subjects, students, existingResults] = await Promise.all([
      tx.subject.findMany({
        where: { institutionId: institution.id, ...(exam.classId ? { classId: exam.classId } : {}) },
        orderBy: { name: "asc" },
      }),
      tx.student.findMany({
        where: { institutionId: institution.id, status: "ACTIVE", ...(exam.classId ? { classId: exam.classId } : {}) },
        orderBy: [{ admissionNo: { sort: "asc", nulls: "last" } }, { fullName: "asc" }],
      }),
      tx.examResult.findMany({ where: { examId, institutionId: institution.id } }),
    ]);

    return {
      exam: {
        id:           exam.id,
        name:         exam.name,
        className:    exam.class?.name ?? null,
        totalMarks:   exam.totalMarks,
        passingMarks: exam.passingMarks,
        examDate:     exam.examDate?.toISOString().split("T")[0] ?? null,
      },
      subjects: subjects.map((s: Subject) => ({ id: s.id, name: s.name })),
      students: students.map((s: Student) => ({ id: s.id, fullName: s.fullName, admissionNo: s.admissionNo })),
      existingResults: existingResults.map((r: ExamResult) => ({
        examId:        r.examId,
        studentId:     r.studentId,
        subjectId:     r.subjectId,
        marksObtained: r.marksObtained,
        grade:         r.grade,
        remarks:       r.remarks,
      })),
    };
  });

  if (!data) notFound();

  return <MarksClient {...data} />;
}
