import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { withRls } from "@/lib/prisma/rls";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Only owners and admins can change the active academic year" }, { status: 403 });
    }

    await withRls(user.id, async (tx) => {
      const found = await tx.academicYear.findFirst({
        where: { id, institutionId: institution.id },
      });
      if (!found) throw new Error("Academic year not found");

      await tx.academicYear.updateMany({
        where: { institutionId: institution.id, NOT: { id } },
        data: { isActive: false },
      });
      await tx.academicYear.update({
        where: { id },
        data: { isActive: true },
      });
    });

    try {
      await prismaAdmin.auditLog.create({
        data: { actorUserId: user.id, institutionId: institution.id, action: "academicYear.activate", targetId: id, meta: {} },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
