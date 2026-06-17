import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "CLASS_UPDATE_FORBIDDEN", "Only owners and admins can update classes");
    const { id } = await params;
    const body = await req.json() as {
      name?: string;
      section?: string;
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
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to update class");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "CLASS_DELETE_FORBIDDEN", "Only owners and admins can delete classes");
    const { id } = await params;

    // Unassign students before deleting the class
    await withRls(user.id, async (tx) => {
      const [attendanceCount, homeworkCount, examCount, noticeCount] = await Promise.all([
        tx.attendanceSession.count({ where: { classId: id, institutionId: institution.id } }),
        tx.homework.count({ where: { classId: id, institutionId: institution.id } }),
        tx.exam.count({ where: { classId: id, institutionId: institution.id } }),
        tx.notice.count({ where: { classId: id, institutionId: institution.id } }),
      ]);
      if (attendanceCount || homeworkCount || examCount || noticeCount) {
        throw new ApiError(
          409,
          "CLASS_HAS_HISTORY",
          "Archive or retain classes that have attendance, homework, exams, or notices",
        );
      }
      await tx.student.updateMany({
        where: { classId: id, institutionId: institution.id },
        data: { classId: null },
      });
      await tx.class.deleteMany({ where: { id, institutionId: institution.id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete class");
  }
}
