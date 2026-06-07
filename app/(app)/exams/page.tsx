import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { ExamsClient } from "./exams-client";
import { Prisma } from "@prisma/client";

type ExamRow = Prisma.ExamGetPayload<{
  include: { class: { select: { name: true } }; _count: { select: { results: true } } };
}>;

export default async function ExamsPage() {
  const { user, institution } = await requireInstitution();

  const { exams, classes, subjects, academicYears, activeYearName } = await withRls(user.id, async (tx) => {
    const [exams, classes, subjects, years] = await Promise.all([
      tx.exam.findMany({
        where: { institutionId: institution.id },
        include: { class: { select: { name: true } }, _count: { select: { results: true } } },
        orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ name: "asc" }, { section: "asc" }],
        select: { id: true, name: true, section: true },
      }),
      tx.subject.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, classId: true },
      }),
      tx.academicYear.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "desc" },
        select: { id: true, name: true, isActive: true },
      }),
    ]);

    return {
      exams: exams.map((e: ExamRow) => ({
        id:           e.id,
        name:         e.name,
        classId:      e.classId,
        className:    e.class?.name ?? null,
        examDate:     e.examDate?.toISOString().split("T")[0] ?? null,
        totalMarks:   e.totalMarks,
        passingMarks: e.passingMarks,
        academicYear: e.academicYear,
        resultCount:  e._count.results,
      })),
      classes: classes.map(c => ({
        id: c.id,
        name: c.section ? `${c.name} – ${c.section}` : c.name,
      })),
      subjects,
      academicYears: years,
      activeYearName: years.find(y => y.isActive)?.name ?? null,
    };
  });

  return (
    <ExamsClient
      exams={exams}
      classes={classes}
      subjects={subjects}
      academicYears={academicYears}
      activeYearName={activeYearName}
    />
  );
}
