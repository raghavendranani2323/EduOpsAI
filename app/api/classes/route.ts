import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole, authorizedClassIds } from "@/lib/auth/permissions";
import { writeAuditEvent } from "@/lib/audit/server";

export async function GET() {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const classes = await withRls(user.id, async (tx) => {
      const ids = await authorizedClassIds(tx, user.id, institution.id, membership.role);
      return tx.class.findMany({
        where: {
          institutionId: institution.id,
          ...(ids !== null ? { id: { in: ids.length ? ids : ["__none__"] } } : {}),
        },
        include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
        orderBy: { name: "asc" },
      });
    });
    return NextResponse.json({ ok: true, classes });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load classes");
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "CLASS_CREATE_FORBIDDEN", "Only owners and admins can create classes");
    const body = await req.json() as {
      name?: string;
      section?: string;
      academicYear?: string;
      academicYearId?: string;
      medium?: string;
      classHeadId?: string | null;
      sectionTeacherId?: string | null;
      classGroupId?: string | null;
    };

    if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });

    const cls = await withRls(user.id, async (tx) => {
      const name = body.name!.trim();
      const medium = body.medium?.trim() || null;
      const classHeadId = body.classHeadId || null;
      const sectionTeacherId = body.sectionTeacherId || null;

      if (classHeadId) {
        const head = await tx.membership.findFirst({
          where: { institutionId: institution.id, userId: classHeadId, revokedAt: null, role: { in: ["OWNER", "ADMIN", "TEACHER"] } },
        });
        if (!head) throw new Error("Class Head must be a staff member in this institution");
      }

      if (sectionTeacherId) {
        const teacher = await tx.membership.findFirst({
          where: { institutionId: institution.id, userId: sectionTeacherId, revokedAt: null, role: { in: ["OWNER", "ADMIN", "TEACHER"] } },
        });
        if (!teacher) throw new Error("Section Class Teacher must be a staff member in this institution");
      }

      const { resolveAcademicYearTx } = await import("@/lib/tenant/academic-year");
      const academicYear = await resolveAcademicYearTx(tx, institution.id, {
        academicYearId: body.academicYearId ?? null,
        academicYear:   body.academicYear   ?? null,
      });

      // If a classGroupId is passed, attach the section to that exact class group.
      // Otherwise upsert a class group by (institution, year, name).
      const classGroup = body.classGroupId
        ? await tx.classGroup.findFirstOrThrow({
            where: { id: body.classGroupId, institutionId: institution.id },
          })
        : await tx.classGroup.upsert({
            where: { institutionId_academicYearId_name: { institutionId: institution.id, academicYearId: academicYear.id, name } },
            create: {
              institutionId: institution.id,
              academicYearId: academicYear.id,
              name,
              medium,
              classHeadId,
            },
            update: {
              ...(medium ? { medium } : {}),
              ...(classHeadId !== null ? { classHeadId } : {}),
            },
          });

      return tx.class.create({
        data: {
          institutionId: institution.id,
          classGroupId: classGroup.id,
          academicYearId: academicYear.id,
          name: classGroup.name,
          section: body.section?.trim() || null,
          medium: classGroup.medium ?? medium,
          academicYear: academicYear.name, // legacy string mirror, kept for back-compat
          sectionTeacherId,
        },
      });
    });
    await writeAuditEvent({ actorUserId: user.id, institutionId: institution.id, action: "class.create", targetId: cls.id, outcome: "success" });
    return NextResponse.json({ ok: true, class: cls }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to create class");
  }
}
