import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { GenerateClient } from "./generate-client";

export default async function GenerateInvoicesPage() {
  const { user, institution } = await requireInstitution();
  const [plans, classes] = await withRls(user.id, async (tx) => {
    const [p, c] = await Promise.all([
      tx.feePlan.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, amount: true, cadence: true, classId: true },
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      }),
    ]);
    return [p, c] as const;
  });

  return <GenerateClient plans={plans} classes={classes} />;
}
