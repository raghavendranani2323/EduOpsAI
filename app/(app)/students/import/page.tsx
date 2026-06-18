import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { ImportClient } from "./import-client";
import Link from "next/link";

export default async function ImportPage() {
  const { user, institution } = await requireInstitution();
  const classes = await withRls(user.id, (tx) =>
    tx.class.findMany({
      where: { institutionId: institution.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
  );
  return (
    <div>
      <ImportClient classes={classes} institutionType={institution.type} />
      <div className="mx-4 mb-6 max-w-2xl rounded-xl border bg-muted/30 p-4 text-sm md:mx-6">
        <p className="font-medium">Import safely</p>
        <p className="mt-1 text-muted-foreground">Use the downloadable template, preview validation errors, and import a small sample first. Existing admission numbers are rejected instead of overwritten.</p>
        <Link href="/support" className="mt-2 inline-block text-primary underline">Import help and support</Link>
      </div>
    </div>
  );
}
