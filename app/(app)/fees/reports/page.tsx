import Link from "next/link";
import { redirect } from "next/navigation";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

export default async function FeeReportsPage() {
  const { user, institution, membership } = await requireInstitution();
  if (membership.role === "TEACHER") redirect("/dashboard");
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const { payments, outstanding } = await withRls(user.id, async (tx) => {
    const [payments, outstanding] = await Promise.all([
      tx.payment.findMany({
        where: { institutionId: institution.id, paidAt: { gte: start } },
        orderBy: { paidAt: "desc" },
        select: {
          id: true, amount: true, mode: true, paidAt: true,
          recorder: { select: { fullName: true } },
          invoice: { select: { student: { select: { fullName: true, class: { select: { name: true, section: true } } } } } },
        },
        take: 1000,
      }),
      tx.invoice.findMany({
        where: { institutionId: institution.id, status: { in: ["UNPAID", "PARTIAL"] } },
        select: { amountDue: true, amountPaid: true, dueDate: true },
        take: 5000,
      }),
    ]);
    return { payments, outstanding };
  });

  const byMode = new Map<string, number>();
  const byCollector = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const payment of payments) {
    byMode.set(payment.mode, (byMode.get(payment.mode) ?? 0) + payment.amount);
    const collector = payment.recorder.fullName || "Unknown";
    byCollector.set(collector, (byCollector.get(collector) ?? 0) + payment.amount);
    const day = payment.paidAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + payment.amount);
  }
  const ageing = { current: 0, days30: 0, days60: 0, days90: 0 };
  for (const invoice of outstanding) {
    const remaining = Math.max(0, invoice.amountDue - invoice.amountPaid);
    const age = Math.floor((today.getTime() - invoice.dueDate.getTime()) / 86_400_000);
    if (age <= 0) ageing.current += remaining;
    else if (age <= 30) ageing.days30 += remaining;
    else if (age <= 60) ageing.days60 += remaining;
    else ageing.days90 += remaining;
  }

  return (
    <div className="max-w-5xl space-y-6 p-4 md:p-6">
      <div><Link href="/fees" className="text-sm text-primary hover:underline">← Fees</Link><h1 className="mt-1 text-xl font-bold">Collection and ageing reports</h1><p className="text-sm text-muted-foreground">Last 30 days · manual collection records</p></div>
      <section>
        <h2 className="mb-2 font-semibold">Outstanding ageing</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[["Not yet due", ageing.current], ["1–30 days", ageing.days30], ["31–60 days", ageing.days60], ["61+ days", ageing.days90]].map(([label, amount]) => (
            <div key={String(label)} className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{formatINR(Number(amount))}</p></div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2"><ReportList title="By payment mode" rows={[...byMode.entries()]} /><ReportList title="By collector" rows={[...byCollector.entries()]} /></div>
      <section className="rounded-xl border"><div className="border-b p-4"><h2 className="font-semibold">Daily collection</h2></div><div className="divide-y">
        {[...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, amount]) => <div key={day} className="flex items-center justify-between px-4 py-3 text-sm"><span>{formatDate(day)}</span><strong>{formatINR(amount)}</strong></div>)}
        {byDay.size === 0 && <p className="p-4 text-sm text-muted-foreground">No collections recorded in the last 30 days.</p>}
      </div></section>
      <section className="rounded-xl border"><div className="border-b p-4"><h2 className="font-semibold">Recent receipts</h2></div><div className="divide-y">
        {payments.slice(0, 50).map((payment) => {
          const cls = payment.invoice.student.class;
          const classLabel = cls ? [cls.name, cls.section].filter(Boolean).join(" – ") : "No class";
          return <div key={payment.id} className="flex items-center gap-3 px-4 py-3 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium">{payment.invoice.student.fullName}</p><p className="text-xs text-muted-foreground">{classLabel} · {payment.mode} · {payment.recorder.fullName}</p></div><div className="text-right"><strong>{formatINR(payment.amount)}</strong><p className="text-xs text-muted-foreground">{formatDate(payment.paidAt)}</p></div></div>;
        })}
      </div></section>
    </div>
  );
}

function ReportList({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return <section className="rounded-xl border"><div className="border-b p-4"><h2 className="font-semibold">{title}</h2></div><div className="divide-y">
    {rows.sort((a, b) => b[1] - a[1]).map(([label, amount]) => <div key={label} className="flex items-center justify-between px-4 py-3 text-sm"><span>{label.replaceAll("_", " ")}</span><strong>{formatINR(amount)}</strong></div>)}
    {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No collection data.</p>}
  </div></section>;
}
