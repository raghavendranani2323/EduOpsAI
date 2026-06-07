import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { HomeworkClient } from "./homework-client";
import type { Homework } from "@prisma/client";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";

export default async function HomeworkPage() {
  const { user, institution, membership } = await requireInstitution();

  const { homework, classes, subjects, scopedToTeacher } = await withRls(user.id, async (tx) => {
    const teacherIds = await getTeacherClassIds(tx, user.id, institution.id, membership.role);
    const scoped = teacherIds !== null;

    const homeworkWhere = {
      institutionId: institution.id,
      ...(scoped ? { classId: { in: teacherIds.length ? teacherIds : ["__none__"] } } : {}),
    };
    const classWhere = {
      institutionId: institution.id,
      ...(scoped ? { id: { in: teacherIds.length ? teacherIds : ["__none__"] } } : {}),
    };

    const [homework, classes, subjects] = await Promise.all([
      tx.homework.findMany({
        where: homeworkWhere,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      tx.class.findMany({
        where: classWhere,
        orderBy: [{ name: "asc" }, { section: "asc" }],
        select: { id: true, name: true, section: true },
      }),
      tx.subject.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, classId: true },
      }),
    ]);
    return {
      homework: homework.map((h: Homework) => ({
        id: h.id, classId: h.classId, subjectId: h.subjectId, teacherId: h.teacherId,
        title: h.title, description: h.description,
        dueDate: h.dueDate?.toISOString().split("T")[0] ?? null,
        createdAt: h.createdAt.toISOString(),
        attachmentUrl: h.attachmentUrl ?? null,
        attachmentMime: h.attachmentMime ?? null,
      })),
      classes: classes.map(c => ({
        id: c.id,
        name: c.section ? `${c.name} – ${c.section}` : c.name,
      })),
      subjects,
      scopedToTeacher: scoped,
    };
  });

  return <HomeworkClient homework={homework} classes={classes} subjects={subjects} scopedToTeacher={scopedToTeacher} />;
}
