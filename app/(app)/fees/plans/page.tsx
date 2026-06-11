import { redirect } from "next/navigation";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { PlansClient } from "./plans-client";

export default async function FeePlansPage() {
  const { user, institution, membership } = await requireInstitution();
  if (membership.role === "TEACHER") redirect("/dashboard");
  const { plans, classes, academicYears } = await withRls(user.id, async (tx) => {
    const [p, c, y] = await Promise.all([
      tx.feePlan.findMany({
        where: { institutionId: institution.id },
        include: {
          class:        { select: { id: true, name: true, section: true } },
          academicYear: { select: { id: true, name: true } },
          components:   { orderBy: { order: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ name: "asc" }, { section: "asc" }],
        select: { id: true, name: true, section: true },
      }),
      tx.academicYear.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "desc" },
        select: { id: true, name: true, isActive: true },
      }),
    ]);
    return { plans: p, classes: c, academicYears: y };
  });

  return <PlansClient plans={plans} classes={classes} academicYears={academicYears} />;
}
