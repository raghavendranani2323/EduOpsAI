import type { Metadata } from "next";
import { PolicyPage } from "@/components/public/policy-page";

export const metadata: Metadata = { title: "Data Rights", alternates: { canonical: "/data-rights" } };

export default function DataRightsPage() {
  return (
    <PolicyPage title="Data access, correction and deletion" updated="18 June 2026">
      <p>Parents, students and staff should first contact their institution because it controls the records stored in EduOps.</p>
      <section><h2 className="text-xl font-semibold">Supported requests</h2><p>Institutions can request access, correction, structured export, account closure or deletion. We verify the requester and institution before acting.</p></section>
      <section><h2 className="text-xl font-semibold">Retention</h2><p>Deletion may be delayed where financial, employment, safeguarding, dispute or legal obligations require records to be retained. Backups expire through the normal backup lifecycle.</p></section>
      <section><h2 className="text-xl font-semibold">How to request</h2><p>Email the support address shown on the support page with the institution name, request type and a safe callback number. Do not email student documents or passwords.</p></section>
    </PolicyPage>
  );
}
