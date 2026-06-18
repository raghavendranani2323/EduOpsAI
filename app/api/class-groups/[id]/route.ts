import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    const body = await req.json() as {
      name?: string;
      medium?: string | null;
      classHeadId?: string | null;
      classLeaderId?: string | null;
      girlsLeaderId?: string | null;
      boysLeaderId?: string | null;
    };

    const result = await withRls(user.id, async (tx) => {
      const group = await tx.classGroup.findFirst({
        where: { id, institutionId: institution.id },
        include: { sections: { select: { id: true } } },
      });
      if (!group) return { count: 0 };

      if (body.classHeadId) {
        const head = await tx.membership.findFirst({
          where: {
            institutionId: institution.id,
            userId: body.classHeadId,
            revokedAt: null,
            role: { in: ["OWNER", "ADMIN", "TEACHER"] },
          },
        });
        if (!head) throw new Error("Class Head must be a staff member in this institution");
      }

      const leaderIds = [body.classLeaderId, body.girlsLeaderId, body.boysLeaderId].filter(Boolean) as string[];
      if (leaderIds.length > 0) {
        const sectionIds = group.sections.map((section) => section.id);
        const validStudents = await tx.student.count({
          where: {
            institutionId: institution.id,
            classId: { in: sectionIds },
            id: { in: leaderIds },
            status: "ACTIVE",
          },
        });
        if (validStudents !== new Set(leaderIds).size) {
          throw new Error("Class leaders must be active students in one of this class's sections");
        }
      }

      await tx.classGroup.update({
        where: { id },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.medium !== undefined ? { medium: body.medium?.trim() || null } : {}),
          ...(body.classHeadId !== undefined ? { classHeadId: body.classHeadId || null } : {}),
          ...(body.classLeaderId !== undefined ? { classLeaderId: body.classLeaderId || null } : {}),
          ...(body.girlsLeaderId !== undefined ? { girlsLeaderId: body.girlsLeaderId || null } : {}),
          ...(body.boysLeaderId !== undefined ? { boysLeaderId: body.boysLeaderId || null } : {}),
        },
      });

      return { count: 1 };
    });

    if (result.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Class group could not be updated" }, { status: 400 });
  }
}
