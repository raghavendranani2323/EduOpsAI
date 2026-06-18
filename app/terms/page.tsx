import type { Metadata } from "next";
import { PolicyPage } from "@/components/public/policy-page";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <PolicyPage title="Service terms" updated="18 June 2026">
      <section><h2 className="text-xl font-semibold">Service scope</h2><p>EduOps provides institution administration tools. Online payment processing is not included unless separately confirmed in writing.</p></section>
      <section><h2 className="text-xl font-semibold">Institution responsibilities</h2><p>Customers must keep accounts secure, provide accurate records, manage staff access, obtain required permissions for personal data and use communication features lawfully.</p></section>
      <section><h2 className="text-xl font-semibold">Availability and changes</h2><p>Maintenance and provider outages can occur. Material service changes will be communicated through the app or registered contact.</p></section>
      <section><h2 className="text-xl font-semibold">Data ownership and export</h2><p>The institution retains ownership of its uploaded records and may export supported datasets. EduOps retains ownership of the software and service design.</p></section>
      <section><h2 className="text-xl font-semibold">Acceptable use</h2><p>Do not misuse the service, attempt unauthorized access, upload malicious content, send unlawful messages or use another institution’s information.</p></section>
    </PolicyPage>
  );
}
