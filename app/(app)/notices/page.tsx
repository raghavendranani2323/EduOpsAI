import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { NoticesClient } from "./notices-client";

export default async function NoticesPage() {
  const { user, institution } = await requireInstitution();

  const { notices, classes } = await withRls(user.id, async (tx) => {
    const [notices, classes] = await Promise.all([
      tx.notice.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: 50,
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    return {
      notices: notices.map(n => ({
        id: n.id, authorId: n.authorId, title: n.title, body: n.body,
        audience: n.audience, classId: n.classId, pinned: n.pinned,
        publishedAt: n.publishedAt.toISOString(),
        expiresAt: n.expiresAt?.toISOString().split("T")[0] ?? null,
      })),
      classes,
    };
  });

  return <NoticesClient notices={notices} classes={classes} />;
}
