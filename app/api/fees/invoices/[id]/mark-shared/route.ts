import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution } = await requireInstitution();
    await withRls(user.id, (tx) =>
      tx.payment.updateMany({
        where: { invoiceId: id, institutionId: institution.id, receiptSharedAt: null },
        data: { receiptSharedAt: new Date() },
      }),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
