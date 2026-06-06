import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { PlansClient } from "./plans-client";

export default async function FeePlansPage() {
  const { user, institution } = await requireInstitution();
  const [plans, classes] = await withRls(user.id, async (tx) => {
    const [p, c] = await Promise.all([
      tx.feePlan.findMany({
        where: { institutionId: institution.id },
        include: { class: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    return [p, c] as const;
  });

  return <PlansClient plans={plans} classes={classes} />;
}
