import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { NewStudentForm } from "./new-student-form";

export default async function NewStudentPage() {
  const { user, institution } = await requireInstitution();
  const [classes, tags] = await withRls(user.id, async (tx) => {
    const [c, t] = await Promise.all([
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ name: "asc" }, { section: "asc" }],
        select: { id: true, name: true, section: true },
      }),
      tx.tag.findMany({
        where: { institutionId: institution.id },
        orderBy: { label: "asc" },
      }),
    ]);
    return [c, t] as const;
  });

  return (
    <NewStudentForm
      classes={classes}
      tags={tags}
      institutionType={institution.type}
    />
  );
}
