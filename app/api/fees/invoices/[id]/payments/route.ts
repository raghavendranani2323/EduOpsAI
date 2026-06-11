import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (membership.role === "TEACHER") return NextResponse.json({ ok: false, error: "Not available for teacher accounts" }, { status: 403 });
    const { id: invoiceId } = await params;
    const body = await req.json() as {
      amount:       number;
      mode:         string;
      referenceNo?: string;
      paidAt:       string;
    };

    const { amount, mode, referenceNo, paidAt } = body;
    if (!amount || !mode || !paidAt) {
      return NextResponse.json({ ok: false, error: "amount, mode, paidAt required" }, { status: 400 });
    }
    if (!["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "ONLINE"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "Invalid payment mode" }, { status: 400 });
    }

    await withRls(user.id, async (tx) => {
      // Verify invoice belongs to institution
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, institutionId: institution.id },
      });
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status === "CANCELLED") throw new Error("Cannot pay a cancelled invoice");

      const remaining = invoice.amountDue - invoice.amountPaid;
      if (amount > remaining) {
        throw new Error(`Amount exceeds balance due (₹${(remaining / 100).toFixed(2)})`);
      }

      // Record payment
      await tx.payment.create({
        data: {
          institutionId: institution.id,
          invoiceId,
          amount,
          mode:          mode as "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "ONLINE",
          referenceNo:   referenceNo ?? null,
          paidAt:        new Date(paidAt),
          recordedBy:    user.id,
        },
      });

      // Recalculate total paid and update invoice status
      const payments = await tx.payment.findMany({ where: { invoiceId }, select: { amount: true } });
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      const newStatus = totalPaid >= invoice.amountDue ? "PAID"
                      : totalPaid > 0                  ? "PARTIAL"
                      :                                  "UNPAID";

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: totalPaid, status: newStatus },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
