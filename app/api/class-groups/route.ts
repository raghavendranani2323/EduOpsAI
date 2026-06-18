import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { resolveAcademicYearTx } from "@/lib/tenant/academic-year";

const schema = z.object({
  name:           z.string().min(1, "Name is required").max(80),
  academicYearId: z.string().optional().or(z.literal("")),
  academicYear:   z.string().max(20).optional().or(z.literal("")),
  medium:         z.string().max(40).optional().or(z.literal("")),
  classHeadId:    z.string().optional().or(z.literal("")),
});

// POST /api/class-groups  — create a class (e.g. "Class 6") without any section yet
export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Only owners and admins can create classes" }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { name, academicYearId, academicYear, medium, classHeadId } = parsed.data;

    const group = await withRls(user.id, async (tx) => {
      const year = await resolveAcademicYearTx(tx, institution.id, {
        academicYearId: academicYearId || null,
        academicYear:   academicYear   || null,
      });

      if (classHeadId) {
        const head = await tx.membership.findFirst({
          where: { institutionId: institution.id, userId: classHeadId, revokedAt: null, role: { in: ["OWNER", "ADMIN", "TEACHER"] } },
        });
        if (!head) throw new Error("Class Head must be a staff member in this institution");
      }

      return tx.classGroup.upsert({
        where: { institutionId_academicYearId_name: { institutionId: institution.id, academicYearId: year.id, name: name.trim() } },
        create: {
          institutionId: institution.id,
          academicYearId: year.id,
          name: name.trim(),
          medium: medium?.trim() || null,
          classHeadId: classHeadId || null,
        },
        update: {
          ...(medium ? { medium: medium.trim() } : {}),
          ...(classHeadId ? { classHeadId } : {}),
        },
      });
    });

    return NextResponse.json({ ok: true, classGroup: group }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Class group could not be created" }, { status: 400 });
  }
}
