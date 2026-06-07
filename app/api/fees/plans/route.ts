import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { resolveAcademicYearTx } from "@/lib/tenant/academic-year";

const componentSchema = z.object({
  name:       z.string().min(1).max(60),
  amount:     z.number().int().min(0).max(10_000_000), // paise
  isOptional: z.boolean().optional(),
});

const schema = z.object({
  name:             z.string().min(1).max(120),
  cadence:          z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
  components:       z.array(componentSchema).min(1, "Add at least one component").max(15),
  lateFeeAmount:    z.number().int().min(0).max(10_000_000).optional(),
  lateFeePercent:   z.number().int().min(0).max(10_000).optional(), // basis points
  lateFeeAfterDays: z.number().int().min(0).max(365).optional(),
  classId:          z.string().optional().or(z.literal("")),
  academicYearId:   z.string().optional().or(z.literal("")),
});

export async function GET() {
  try {
    const { user, institution } = await requireInstitution();
    const plans = await withRls(user.id, (tx) =>
      tx.feePlan.findMany({
        where: { institutionId: institution.id },
        include: {
          class:        { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          components:   { orderBy: { order: "asc" } },
        },
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
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const b = parsed.data;
    const totalAmount = b.components.reduce((s, c) => s + c.amount, 0);

    const plan = await withRls(user.id, async (tx) => {
      const year = await resolveAcademicYearTx(tx, institution.id, {
        academicYearId: b.academicYearId || null,
        academicYear:   null,
      });
      return tx.feePlan.create({
        data: {
          institutionId:    institution.id,
          academicYearId:   year.id,
          name:             b.name.trim(),
          amount:           totalAmount,
          cadence:          b.cadence,
          lateFeeAmount:    b.lateFeeAmount   ?? 0,
          lateFeePercent:   b.lateFeePercent  ?? 0,
          lateFeeAfterDays: b.lateFeeAfterDays ?? 10,
          classId:          b.classId || null,
          components: {
            create: b.components.map((c, i) => ({
              name:       c.name.trim(),
              amount:     c.amount,
              isOptional: c.isOptional ?? false,
              order:      i,
            })),
          },
        },
        include: {
          components:   { orderBy: { order: "asc" } },
          class:        { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      });
    });
    return NextResponse.json({ ok: true, plan }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
