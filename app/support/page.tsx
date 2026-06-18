import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/public/policy-page";

export const metadata: Metadata = { title: "Support", alternates: { canonical: "/support" } };

export default function SupportPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@eduops.in";
  return (
    <PolicyPage title="Support" updated="18 June 2026">
      <p>Email <a className="text-primary underline" href={`mailto:${email}`}>{email}</a>. Include your institution name, the page, approximate time and the request ID shown in any error.</p>
      <section><h2 className="text-xl font-semibold">Security or privacy concern</h2><p>Use the subject “Security” or “Privacy”. Do not send passwords, OTPs, access tokens or full student datasets by email.</p></section>
      <section><h2 className="text-xl font-semibold">Refunds and cancellation</h2><p>Payment integration is currently deferred. For any subscription charge arranged separately, contact support before renewal. Cancellation stops future renewals; statutory rights and written commercial terms continue to apply.</p></section>
      <p><Link className="text-primary underline" href="/status">Check service status</Link></p>
    </PolicyPage>
  );
}
