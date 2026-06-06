import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { verifyRazorpaySignature } from "@/lib/razorpay/client";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id: invoiceId } = await params;
    const { orderId, paymentId, signature } = await req.json() as {
      orderId: string; paymentId: string; signature: string;
    };

    if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
      return NextResponse.json({ ok: false, error: "Invalid payment signature" }, { status: 400 });
    }

    // Idempotency check + record
    await withRls(user.id, async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, institutionId: institution.id } });
      if (!invoice) throw new Error("Invoice not found");

      const existing = await tx.payment.findUnique({ where: { razorpayPaymentId: paymentId } });
      if (existing) return; // already recorded (webhook beat us)

      await tx.payment.create({
        data: {
          institutionId:            institution.id,
          invoiceId,
          amount:                   invoice.amountDue - invoice.amountPaid,
          mode:                     "ONLINE",
          paidAt:                   new Date(),
          recordedBy:               user.id,
          razorpayOrderId:          orderId,
          razorpayPaymentId:        paymentId,
          razorpaySignatureVerified: true,
        },
      });

      const payments = await tx.payment.findMany({ where: { invoiceId }, select: { amount: true } });
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      const newStatus = totalPaid >= invoice.amountDue ? "PAID" : "PARTIAL";
      await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid: totalPaid, status: newStatus } });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
