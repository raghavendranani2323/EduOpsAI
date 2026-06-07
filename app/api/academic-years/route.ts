import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { withRls } from "@/lib/prisma/rls";

const createSchema = z.object({
  name:      z.string().regex(/^\d{4}-\d{2,4}$/, "Use format YYYY-YY (e.g. 2026-27)").min(7).max(9),
  startsOn:  z.string().optional().or(z.literal("")),
  endsOn:    z.string().optional().or(z.literal("")),
  setActive: z.boolean().optional().default(false),
});

// GET — list all academic years for this institution
export async function GET() {
  try {
    const { user, institution } = await requireInstitution();
    const [years, classCounts] = await withRls(user.id, async (tx) => {
      const years = await tx.academicYear.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "desc" },
      });
      // Count classes per year so the UI can show "5 classes" inline
      const counts = await tx.class.groupBy({
        by: ["academicYearId"],
        where: { institutionId: institution.id, academicYearId: { not: null } },
        _count: { _all: true },
      });
      return [years, counts];
    });
    const countMap = new Map(classCounts.map(c => [c.academicYearId, c._count._all]));
    return NextResponse.json({
      ok: true,
      academicYears: years.map(y => ({
        id: y.id,
        name: y.name,
        startsOn: y.startsOn,
        endsOn: y.endsOn,
        isActive: y.isActive,
        classCount: countMap.get(y.id) ?? 0,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

// POST — create a new academic year (optionally setActive)
export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Only owners and admins can create academic years" }, { status: 403 });
    }
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { name, startsOn, endsOn, setActive } = parsed.data;

    const created = await withRls(user.id, async (tx) => {
      // Duplicate guard
      const dup = await tx.academicYear.findFirst({
        where: { institutionId: institution.id, name: name.trim() },
      });
      if (dup) throw new Error("That academic year already exists");

      const year = await tx.academicYear.create({
        data: {
          institutionId: institution.id,
          name: name.trim(),
          startsOn: startsOn ? new Date(startsOn) : null,
          endsOn:   endsOn   ? new Date(endsOn)   : null,
          isActive: false,
        },
      });

      if (setActive) {
        await tx.academicYear.updateMany({
          where: { institutionId: institution.id, NOT: { id: year.id } },
          data: { isActive: false },
        });
        await tx.academicYear.update({
          where: { id: year.id },
          data: { isActive: true },
        });
        return { ...year, isActive: true };
      }
      return year;
    });

    // Audit
    try {
      await prismaAdmin.auditLog.create({
        data: {
          actorUserId:   user.id,
          institutionId: institution.id,
          action:        "academicYear.create",
          targetId:      created.id,
          meta:          { name: created.name, setActive },
        },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, academicYear: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
