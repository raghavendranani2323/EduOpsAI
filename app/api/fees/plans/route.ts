import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET() {
  try {
    const { user, institution } = await requireInstitution();
    const plans = await withRls(user.id, (tx) =>
      tx.feePlan.findMany({
        where: { institutionId: institution.id },
        include: { class: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      })
    );
    return NextResponse.json({ ok: true, plans });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as {
      name: string; amount: number; cadence: string;
      lateFeeAmount?: number; lateFeeAfterDays?: number; classId?: string | null;
    };

    if (!body.name?.trim() || !body.amount || !body.cadence) {
      return NextResponse.json({ ok: false, error: "name, amount, cadence required" }, { status: 400 });
    }

    const plan = await withRls(user.id, (tx) =>
      tx.feePlan.create({
        data: {
          institutionId:    institution.id,
          name:             body.name.trim(),
          amount:           body.amount,
          cadence:          body.cadence as "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME",
          lateFeeAmount:    body.lateFeeAmount ?? 0,
          lateFeeAfterDays: body.lateFeeAfterDays ?? 10,
          classId:          body.classId || null,
        },
      })
    );
    return NextResponse.json({ ok: true, plan }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
