import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { formatDate, todayIST } from "@/lib/format/date";
import { RecordPaymentClient } from "./record-payment-client";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }              = await params;
  const { user, institution } = await requireInstitution();
  const today               = todayIST();

  const invoice = await withRls(user.id, (tx) =>
    tx.invoice.findFirst({
      where: { id, institutionId: institution.id },
      include: {
        student: {
          include: { class: { select: { id: true, name: true } } },
        },
        feePlan: { select: { id: true, name: true, cadence: true } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    })
  );

  if (!invoice) notFound();

  const remaining = invoice.amountDue - invoice.amountPaid;
  const isOverdue = (invoice.status === "UNPAID" || invoice.status === "PARTIAL")
    && invoice.dueDate.toISOString().split("T")[0] < today;

  const STATUS_STYLE: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    UNPAID: isOverdue ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground",
    CANCELLED: "bg-muted text-muted-foreground",
  };

  const PAYMENT_ICONS: Record<string, string> = {
    CASH: "₹", UPI: "UPI", BANK_TRANSFER: "Bank", CHEQUE: "Cheque", ONLINE: "Online",
  };

  return (
    <div className="p-4 md:p-6 max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/fees" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{invoice.student.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.student.class?.name ?? "No class"}
            {invoice.feePlan ? ` · ${invoice.feePlan.name}` : ""}
          </p>
        </div>
        <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${STATUS_STYLE[invoice.status] ?? ""}`}>
          {isOverdue ? "Overdue" : invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}
        </span>
      </div>

      {/* Invoice details */}
      <section className="border rounded-xl divide-y">
        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-semibold">{formatINR(invoice.amountDue)}</span>
        </div>
        {invoice.amountPaid > 0 && (
          <div className="px-4 py-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Paid</span>
            <span className="font-medium text-green-700">{formatINR(invoice.amountPaid)}</span>
          </div>
        )}
        {remaining > 0 && (
          <div className="px-4 py-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-semibold text-destructive">{formatINR(remaining)}</span>
          </div>
        )}
        {invoice.periodStart && (
          <div className="px-4 py-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Period</span>
            <span>{formatDate(invoice.periodStart)}{invoice.periodEnd ? ` – ${formatDate(invoice.periodEnd)}` : ""}</span>
          </div>
        )}
        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Due date</span>
          <span className={isOverdue ? "text-destructive font-medium" : ""}>{formatDate(invoice.dueDate)}</span>
        </div>
      </section>

      {/* Payment history */}
      {invoice.payments.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Payment history</h2>
          {invoice.payments.map(p => (
            <div key={p.id} className="flex items-center gap-3 border rounded-xl p-3">
              <div className="h-9 w-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">
                {PAYMENT_ICONS[p.mode] ?? p.mode.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{formatINR(p.amount)}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {p.mode.toLowerCase().replace("_", " ")} · {formatDate(p.paidAt)}
                  {p.referenceNo ? ` · ${p.referenceNo}` : ""}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Record payment (client component) */}
      {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
        <RecordPaymentClient
          invoiceId={invoice.id}
          remaining={remaining}
        />
      )}
    </div>
  );
}
