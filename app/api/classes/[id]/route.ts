import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    const body = await req.json() as {
      name?: string;
      section?: string;
      academicYear?: string;
      medium?: string | null;
      sectionTeacherId?: string | null;
      sectionLeaderId?: string | null;
      girlsLeaderId?: string | null;
      boysLeaderId?: string | null;
    };

    const cls = await withRls(user.id, async (tx) => {
      const existing = await tx.class.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return { count: 0 };

      if (body.sectionTeacherId) {
        const teacher = await tx.membership.findFirst({
          where: { institutionId: institution.id, userId: body.sectionTeacherId, revokedAt: null, role: { in: ["OWNER", "ADMIN", "TEACHER"] } },
        });
        if (!teacher) throw new Error("Section Class Teacher must be a staff member in this institution");
      }

      const leaderIds = [body.sectionLeaderId, body.girlsLeaderId, body.boysLeaderId].filter(Boolean) as string[];
      if (leaderIds.length > 0) {
        const validStudents = await tx.student.count({
          where: { institutionId: institution.id, classId: id, id: { in: leaderIds }, status: "ACTIVE" },
        });
        if (validStudents !== new Set(leaderIds).size) {
          throw new Error("Section leaders must be active students in this section");
        }
      }

      return tx.class.updateMany({
        where: { id, institutionId: institution.id },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.section !== undefined ? { section: body.section?.trim() || null } : {}),
          ...(body.academicYear ? { academicYear: body.academicYear.trim() } : {}),
          ...(body.medium !== undefined ? { medium: body.medium?.trim() || null } : {}),
          ...(body.sectionTeacherId !== undefined ? { sectionTeacherId: body.sectionTeacherId || null } : {}),
          ...(body.sectionLeaderId !== undefined ? { sectionLeaderId: body.sectionLeaderId || null } : {}),
          ...(body.girlsLeaderId !== undefined ? { girlsLeaderId: body.girlsLeaderId || null } : {}),
          ...(body.boysLeaderId !== undefined ? { boysLeaderId: body.boysLeaderId || null } : {}),
        },
      });
    });

    if (cls.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unauthorised" }, { status: 401 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;

    // Unassign students before deleting the class
    await withRls(user.id, async (tx) => {
      await tx.student.updateMany({
        where: { classId: id, institutionId: institution.id },
        data: { classId: null },
      });
      await tx.class.deleteMany({ where: { id, institutionId: institution.id } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
