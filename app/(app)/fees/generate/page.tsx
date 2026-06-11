import { redirect } from "next/navigation";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { GenerateClient } from "./generate-client";

export default async function GenerateInvoicesPage() {
  const { user, institution, membership } = await requireInstitution();
  if (membership.role === "TEACHER") redirect("/dashboard");
  const { plans, classes } = await withRls(user.id, async (tx) => {
    const [p, c] = await Promise.all([
      tx.feePlan.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        include: { class: { select: { id: true, name: true, section: true } } },
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ name: "asc" }, { section: "asc" }],
        include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      }),
    ]);
    return { plans: p, classes: c };
  });

  const sd = Array.isArray(institution.siblingDiscounts) ? institution.siblingDiscounts : [];
  return (
    <GenerateClient
      plans={plans.map(p => ({
        id: p.id, name: p.name, amount: p.amount, cadence: p.cadence, classId: p.classId,
        className: p.class ? `${p.class.name}${p.class.section ? "-" + p.class.section : ""}` : null,
      }))}
      classes={classes.map(c => ({
        id: c.id,
        label: c.section ? `${c.name} – ${c.section}` : c.name,
        count: c._count.students,
      }))}
      hasSiblingDiscount={sd.length > 0}
    />
  );
}
