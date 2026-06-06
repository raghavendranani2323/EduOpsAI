import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { createRazorpayOrder } from "@/lib/razorpay/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id: invoiceId } = await params;

    const invoice = await withRls(user.id, (tx) =>
      tx.invoice.findFirst({
        where:   { id: invoiceId, institutionId: institution.id },
        include: { student: { select: { fullName: true } } },
      })
    );
    if (!invoice)                     return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (invoice.status === "PAID")    return NextResponse.json({ ok: false, error: "Already paid" }, { status: 400 });
    if (invoice.status === "CANCELLED") return NextResponse.json({ ok: false, error: "Cancelled" }, { status: 400 });

    const remaining = invoice.amountDue - invoice.amountPaid;
    if (remaining <= 0) return NextResponse.json({ ok: false, error: "No balance due" }, { status: 400 });

    const order = await createRazorpayOrder({
      amount:  remaining,
      receipt: invoiceId.slice(0, 40),
      notes:   {
        invoiceId,
        studentName: invoice.student.fullName,
        institution: institution.name,
      },
    });

    return NextResponse.json({
      ok:      true,
      orderId: order.id,
      amount:  order.amount,
      keyId:   process.env.RAZORPAY_KEY_ID,
      studentName: invoice.student.fullName,
      institutionName: institution.name,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
