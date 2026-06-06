import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    const body = await req.json() as {
      name?: string; amount?: number; cadence?: string;
      lateFeeAmount?: number; lateFeeAfterDays?: number; classId?: string | null;
    };

    const r = await withRls(user.id, (tx) =>
      tx.feePlan.updateMany({
        where: { id, institutionId: institution.id },
        data: {
          ...(body.name             !== undefined ? { name: body.name.trim() }                                          : {}),
          ...(body.amount           !== undefined ? { amount: body.amount }                                             : {}),
          ...(body.cadence          !== undefined ? { cadence: body.cadence as "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME" } : {}),
          ...(body.lateFeeAmount    !== undefined ? { lateFeeAmount: body.lateFeeAmount }                               : {}),
          ...(body.lateFeeAfterDays !== undefined ? { lateFeeAfterDays: body.lateFeeAfterDays }                         : {}),
          ...(body.classId          !== undefined ? { classId: body.classId || null }                                   : {}),
        },
      })
    );
    if (r.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    await withRls(user.id, (tx) =>
      tx.feePlan.deleteMany({ where: { id, institutionId: institution.id } })
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
