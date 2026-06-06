import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const { user, institution } = await requireInstitution();
  const classes = await withRls(user.id, (tx) =>
    tx.class.findMany({
      where: { institutionId: institution.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
  );
  return <ImportClient classes={classes} institutionType={institution.type} />;
}
