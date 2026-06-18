import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { withRls } from "@/lib/prisma/rls";

const patchSchema = z.object({
  name:     z.string().regex(/^\d{4}-\d{2,4}$/).optional(),
  startsOn: z.string().optional().or(z.literal("")).or(z.null()),
  endsOn:   z.string().optional().or(z.literal("")).or(z.null()),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Only owners and admins can edit academic years" }, { status: 403 });
    }
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const updated = await withRls(user.id, async (tx) => {
      const existing = await tx.academicYear.findFirst({
        where: { id, institutionId: institution.id },
      });
      if (!existing) throw new Error("Academic year not found");

      // Name change must remain unique inside this institution
      if (parsed.data.name && parsed.data.name !== existing.name) {
        const clash = await tx.academicYear.findFirst({
          where: { institutionId: institution.id, name: parsed.data.name, NOT: { id } },
        });
        if (clash) throw new Error("Another academic year with that name already exists");
      }

      return tx.academicYear.update({
        where: { id },
        data: {
          ...(parsed.data.name      ? { name: parsed.data.name }                                          : {}),
          ...(parsed.data.startsOn !== undefined ? { startsOn: parsed.data.startsOn ? new Date(parsed.data.startsOn) : null } : {}),
          ...(parsed.data.endsOn   !== undefined ? { endsOn:   parsed.data.endsOn   ? new Date(parsed.data.endsOn)   : null } : {}),
        },
      });
    });

    try {
      await prismaAdmin.auditLog.create({
        data: { actorUserId: user.id, institutionId: institution.id, action: "academicYear.update", targetId: id, meta: parsed.data },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, academicYear: updated });
  } catch {
    return NextResponse.json({ ok: false, error: "Academic year could not be updated" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Only owners and admins can delete academic years" }, { status: 403 });
    }

    await withRls(user.id, async (tx) => {
      const existing = await tx.academicYear.findFirst({
        where: { id, institutionId: institution.id },
        include: { _count: { select: { classes: true, classGroups: true } } },
      });
      if (!existing) throw new Error("Academic year not found");
      if (existing._count.classes > 0 || existing._count.classGroups > 0) {
        throw new Error(`Cannot delete — ${existing._count.classGroups} class${existing._count.classGroups === 1 ? "" : "es"} reference this year`);
      }
      if (existing.isActive) {
        throw new Error("Cannot delete the active academic year. Activate another first.");
      }
      await tx.academicYear.delete({ where: { id } });
    });

    try {
      await prismaAdmin.auditLog.create({
        data: { actorUserId: user.id, institutionId: institution.id, action: "academicYear.delete", targetId: id, meta: {} },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Academic year cannot be deleted while it is active or in use" }, { status: 400 });
  }
}
