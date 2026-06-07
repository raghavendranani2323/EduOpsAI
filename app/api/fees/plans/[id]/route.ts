import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

const componentSchema = z.object({
  name:       z.string().min(1).max(60),
  amount:     z.number().int().min(0).max(10_000_000),
  isOptional: z.boolean().optional(),
});

const schema = z.object({
  name:             z.string().min(1).max(120).optional(),
  cadence:          z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]).optional(),
  components:       z.array(componentSchema).min(1).max(15).optional(),
  lateFeeAmount:    z.number().int().min(0).max(10_000_000).optional(),
  lateFeePercent:   z.number().int().min(0).max(10_000).optional(),
  lateFeeAfterDays: z.number().int().min(0).max(365).optional(),
  classId:          z.string().nullable().optional().or(z.literal("")),
  academicYearId:   z.string().nullable().optional().or(z.literal("")),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const b = parsed.data;

    const ok = await withRls(user.id, async (tx) => {
      const existing = await tx.feePlan.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return false;

      const totalAmount = b.components ? b.components.reduce((s, c) => s + c.amount, 0) : undefined;
      await tx.feePlan.update({
        where: { id },
        data: {
          ...(b.name             !== undefined ? { name: b.name.trim() }                            : {}),
          ...(b.cadence          !== undefined ? { cadence: b.cadence }                             : {}),
          ...(totalAmount        !== undefined ? { amount: totalAmount }                            : {}),
          ...(b.lateFeeAmount    !== undefined ? { lateFeeAmount: b.lateFeeAmount }                 : {}),
          ...(b.lateFeePercent   !== undefined ? { lateFeePercent: b.lateFeePercent }               : {}),
          ...(b.lateFeeAfterDays !== undefined ? { lateFeeAfterDays: b.lateFeeAfterDays }           : {}),
          ...(b.classId          !== undefined ? { classId: b.classId || null }                     : {}),
          ...(b.academicYearId   !== undefined ? { academicYearId: b.academicYearId || null }       : {}),
        },
      });

      if (b.components) {
        await tx.feePlanComponent.deleteMany({ where: { planId: id } });
        await tx.feePlanComponent.createMany({
          data: b.components.map((c, i) => ({
            planId: id,
            name: c.name.trim(),
            amount: c.amount,
            isOptional: c.isOptional ?? false,
            order: i,
          })),
        });
      }
      return true;
    });

    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await withRls(user.id, async (tx) => {
      const linkedInvoices = await tx.invoice.count({ where: { feePlanId: id, institutionId: institution.id } });
      if (linkedInvoices > 0) {
        throw new Error(`Plan has ${linkedInvoices} invoice${linkedInvoices === 1 ? "" : "s"} — cannot delete`);
      }
      await tx.feePlan.deleteMany({ where: { id, institutionId: institution.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Forbidden" }, { status: 400 });
  }
}
