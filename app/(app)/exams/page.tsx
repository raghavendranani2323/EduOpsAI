import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { ExamsClient } from "./exams-client";

export default async function ExamsPage() {
  const { user, institution } = await requireInstitution();

  const { exams, classes, subjects } = await withRls(user.id, async (tx) => {
    const [exams, classes, subjects] = await Promise.all([
      tx.exam.findMany({
        where: { institutionId: institution.id },
        include: { class: { select: { name: true } }, _count: { select: { results: true } } },
        orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      tx.subject.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, classId: true },
      }),
    ]);

    return {
      exams: exams.map(e => ({
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
      classes,
      subjects,
    };
  });

  return <ExamsClient exams={exams} classes={classes} subjects={subjects} />;
}
