import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { formatDate, todayIST } from "@/lib/format/date";
import { RecordPaymentClient } from "./record-payment-client";
import { RazorpayCheckout } from "./razorpay-checkout";
import { ReceiptActions } from "./receipt-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { headers } from "next/headers";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }              = await params;
  const { user, institution, membership } = await requireInstitution();
  if (membership.role === "TEACHER") redirect("/dashboard");
  const today               = todayIST();

  const invoice = await withRls(user.id, (tx) =>
    tx.invoice.findFirst({
      where: { id, institutionId: institution.id },
      include: {
        student: {
          include: {
            class:    { select: { id: true, name: true, section: true } },
            guardians: {
              where: { isPrimary: true },
              include: { guardian: { select: { fullName: true, phone: true } } },
              take: 1,
            },
          },
        },
        feePlan: {
          include: { components: { orderBy: { order: "asc" } } },
        },
        payments: { orderBy: { paidAt: "desc" } },
      },
    })
  );

  if (!invoice) notFound();

  const remaining = invoice.amountDue - invoice.amountPaid;
  const isOverdue = (invoice.status === "UNPAID" || invoice.status === "PARTIAL")
    && invoice.dueDate.toISOString().split("T")[0] < today;
  const guardianPhone = invoice.student.guardians[0]?.guardian.phone ?? null;
  const className = [invoice.student.class?.name, invoice.student.class?.section].filter(Boolean).join(" – ");

  // App origin for WhatsApp share link — works in preview + production
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host  = h.get("host") ?? "";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

  const statusVariant =
    invoice.status === "PAID"    ? "success" :
    invoice.status === "PARTIAL" ? "warning" :
    isOverdue                    ? "destructive" :
    invoice.status === "CANCELLED" ? "secondary" : "secondary";

  const PAYMENT_ICONS: Record<string, string> = {
    CASH: "₹", UPI: "UPI", BANK_TRANSFER: "Bank", CHEQUE: "Chq", ONLINE: "Net",
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/fees" className="tap h-10 w-10 -ml-1 rounded-xl flex items-center justify-center hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{invoice.student.fullName}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {className || "No class"}
            {invoice.feePlan ? ` · ${invoice.feePlan.name}` : ""}
          </p>
        </div>
        <Badge variant={statusVariant}>
          {isOverdue ? "Overdue" : invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {/* Receipt + WhatsApp actions */}
      <ReceiptActions
        invoiceId={invoice.id}
        studentName={invoice.student.fullName}
        guardianPhone={guardianPhone}
        amountDue={invoice.amountDue}
        amountPaid={invoice.amountPaid}
        institutionName={institution.name}
        appOrigin={appOrigin}
      />

      {/* Amount summary */}
      <Card>
        <div className="p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total</span>
            <span className="text-2xl font-bold tabular-nums">{formatINR(invoice.amountDue)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Paid</span>
              <span className="text-lg font-semibold tabular-nums text-green-700 dark:text-green-300">{formatINR(invoice.amountPaid)}</span>
            </div>
          )}
          {remaining > 0 && (
            <div className="flex items-baseline justify-between pt-2 border-t border-border">
              <span className="text-xs uppercase tracking-wider font-bold">Balance due</span>
              <span className="text-xl font-bold tabular-nums text-destructive">{formatINR(remaining)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Components breakup */}
      {invoice.feePlan && invoice.feePlan.components.length > 0 && (
        <Card>
          <div className="p-5">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">Components</p>
            <ul className="space-y-1">
              {invoice.feePlan.components.map(c => (
                <li key={c.id} className="flex items-baseline justify-between text-sm">
                  <span>{c.name}{c.isOptional ? " (opt.)" : ""}</span>
                  <span className="font-mono tabular-nums">{formatINR(c.amount)}</span>
                </li>
              ))}
            </ul>
            {invoice.notes && (
              <p className="text-xs text-green-700 dark:text-green-300 mt-3 pt-3 border-t">
                {invoice.notes}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Period + due meta */}
      <Card>
        <div className="p-4 space-y-2 text-sm">
          {invoice.periodStart && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period</span>
              <span>{formatDate(invoice.periodStart)}{invoice.periodEnd ? ` – ${formatDate(invoice.periodEnd)}` : ""}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Due date</span>
            <span className={isOverdue ? "text-destructive font-medium" : ""}>{formatDate(invoice.dueDate)}</span>
          </div>
          {invoice.receiptNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt #</span>
              <span className="font-mono">{invoice.receiptNumber}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Payment history */}
      {invoice.payments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment history</p>
          {invoice.payments.map(p => (
            <Card key={p.id}>
              <div className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 flex items-center justify-center text-xs font-bold shrink-0">
                  {PAYMENT_ICONS[p.mode] ?? p.mode.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold tabular-nums">{formatINR(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.mode.toLowerCase().replace("_", " ")} · {formatDate(p.paidAt)}
                    {p.referenceNo ? ` · ${p.referenceNo}` : ""}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Payment options */}
      {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
        <div className="space-y-3">
          {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && (
            <RazorpayCheckout invoiceId={invoice.id} remaining={remaining} />
          )}
          <RecordPaymentClient invoiceId={invoice.id} remaining={remaining} />
        </div>
      )}
    </div>
  );
}
