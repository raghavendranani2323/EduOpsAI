import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { prisma } from "@/lib/prisma/client";

export async function POST(req: Request) {
  const rawBody  = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  let event: { event: string; payload: { payment: { entity: Record<string, unknown> } } };
  try { event = JSON.parse(rawBody); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event !== "payment.captured") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payment  = event.payload.payment.entity;
  const orderId  = payment.order_id  as string;
  const paymentId = payment.id       as string;
  const amount    = payment.amount   as number;
  const notes     = payment.notes    as Record<string, string>;
  const invoiceId = notes?.invoiceId;

  if (!invoiceId) return NextResponse.json({ ok: false, error: "invoiceId missing in notes" }, { status: 400 });

  // Idempotency: skip if this razorpayPaymentId already recorded
  const existing = await prisma.payment.findUnique({ where: { razorpayPaymentId: paymentId } });
  if (existing) return NextResponse.json({ ok: true, deduplicated: true });

  // Record payment (service-role context — no RLS; explicitly scope by institutionId from invoice)
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });

  // Attribute system-recorded payment to the institution OWNER (FK to profiles requires a real user)
  const ownerMembership = await prisma.membership.findFirst({
    where: { institutionId: invoice.institutionId, role: "OWNER", revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!ownerMembership) return NextResponse.json({ ok: false, error: "Owner not found for institution" }, { status: 500 });

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        institutionId:            invoice.institutionId,
        invoiceId,
        amount,
        mode:                     "ONLINE",
        paidAt:                   new Date(),
        recordedBy:               ownerMembership.userId,
        razorpayOrderId:          orderId,
        razorpayPaymentId:        paymentId,
        razorpaySignatureVerified: true,
      },
    });

    const payments = await tx.payment.findMany({ where: { invoiceId }, select: { amount: true } });
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const newStatus = totalPaid >= invoice.amountDue ? "PAID"
                    : totalPaid > 0                  ? "PARTIAL"
                    :                                  "UNPAID";

    await tx.invoice.update({
      where: { id: invoiceId },
      data:  { amountPaid: totalPaid, status: newStatus },
    });
  });

  return NextResponse.json({ ok: true });
}
