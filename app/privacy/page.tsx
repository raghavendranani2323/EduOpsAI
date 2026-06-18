import type { Metadata } from "next";
import { PolicyPage } from "@/components/public/policy-page";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy notice" updated="18 June 2026">
      <section><h2 className="text-xl font-semibold">Who controls school data</h2><p>The institution using EduOps controls its student, guardian and staff records. EduOps processes that information to provide the service.</p></section>
      <section><h2 className="text-xl font-semibold">Information processed</h2><p>This can include identity and contact details, class records, attendance, fee records, homework, notices, admission enquiries, device diagnostics and security logs.</p></section>
      <section><h2 className="text-xl font-semibold">Children’s information</h2><p>Institutions must have an appropriate lawful basis and provide required notices or consent before adding children’s information. EduOps does not use children’s data for advertising.</p></section>
      <section><h2 className="text-xl font-semibold">Security and sharing</h2><p>Tenant isolation, access controls and audit records protect institutional data. Information is shared only with service providers needed to operate EduOps or where legally required.</p></section>
      <section><h2 className="text-xl font-semibold">Retention and requests</h2><p>Institutions choose their retention period and can export or request deletion, subject to legal recordkeeping duties. Contact support for access, correction, export or deletion requests.</p></section>
      <p className="rounded-xl border p-4 text-muted-foreground">This operational notice is not legal advice. Institutions should obtain qualified review for their own DPDP and sector obligations.</p>
    </PolicyPage>
  );
}
