import { requireInstitution } from "@/lib/tenant/current";

export default async function DashboardPage() {
  const { institution, membership } = await requireInstitution();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Good morning 👋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{institution.name}</p>
      </div>

      <div className="rounded-xl border bg-primary/5 p-4 text-sm">
        <p className="font-medium text-primary">Dashboard coming soon</p>
        <p className="text-muted-foreground mt-1">
          Role: {membership.role} — Building the action centre next.
        </p>
      </div>
    </div>
  );
}
