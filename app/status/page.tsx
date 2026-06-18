import type { Metadata } from "next";
import { PolicyPage } from "@/components/public/policy-page";
import { prismaAdmin } from "@/lib/prisma/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Service Status" };

export default async function StatusPage() {
  let operational = false;
  try {
    await prismaAdmin.$queryRaw`SELECT 1`;
    operational = true;
  } catch {
    operational = false;
  }
  return (
    <PolicyPage title="Service status" updated="Live">
      <div className={`rounded-xl border p-4 ${operational ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        <p className="font-semibold">Application status: {operational ? "operational" : "degraded"}</p>
        <p className="mt-1">{operational ? "The application and primary database are responding." : "The primary database health check did not complete successfully."} Provider-specific delivery status is shown inside the relevant module.</p>
      </div>
      <p>For an outage report, include the exact time, affected institution and request ID when contacting support.</p>
    </PolicyPage>
  );
}
