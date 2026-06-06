import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { HomeworkClient } from "./homework-client";

export default async function HomeworkPage() {
  const { user, institution } = await requireInstitution();

  const { homework, classes, subjects } = await withRls(user.id, async (tx) => {
    const [homework, classes, subjects] = await Promise.all([
      tx.homework.findMany({
        where: { institutionId: institution.id },
        orderBy: { createdAt: "desc" },
        take: 100,
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
      homework: homework.map(h => ({
        id: h.id, classId: h.classId, subjectId: h.subjectId, teacherId: h.teacherId,
        title: h.title, description: h.description,
        dueDate: h.dueDate?.toISOString().split("T")[0] ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
      classes,
      subjects,
    };
  });

  return <HomeworkClient homework={homework} classes={classes} subjects={subjects} />;
}
