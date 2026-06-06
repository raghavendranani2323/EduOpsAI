import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { NoticesClient } from "./notices-client";

export default async function NoticesPage() {
  const { user, institution } = await requireInstitution();

  const { notices, classes } = await withRls(user.id, async (tx) => {
    const [notices, classes, activeStudents] = await Promise.all([
      tx.notice.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: 50,
        include: { _count: { select: { reads: true } } },
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      }),
      tx.student.count({ where: { institutionId: institution.id, status: "ACTIVE" } }),
    ]);

    const classCountMap: Record<string, number> = {};
    classes.forEach(c => { classCountMap[c.id] = c._count.students; });

    return {
      notices: notices.map(n => {
        const target =
          n.audience === "CLASS" && n.classId
            ? classCountMap[n.classId] ?? 0
            : activeStudents;
        return {
          id: n.id, authorId: n.authorId, title: n.title, body: n.body,
          audience: n.audience, classId: n.classId, pinned: n.pinned,
          publishedAt: n.publishedAt.toISOString(),
          expiresAt: n.expiresAt?.toISOString().split("T")[0] ?? null,
          readCount:   n._count.reads,
          targetCount: target,
        };
      }),
      classes: classes.map(c => ({ id: c.id, name: c.name })),
    };
  });

  return <NoticesClient notices={notices} classes={classes} />;
}
