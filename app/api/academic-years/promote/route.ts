import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { withRls } from "@/lib/prisma/rls";

const schema = z.object({
  fromYearId: z.string().min(1),
  toYearId:   z.string().min(1),
  dryRun:     z.boolean().optional().default(false),
});

interface MapEntry { fromClassId: string; toClassId: string; promote: boolean }

/**
 * Promote students from one academic year to the next. The caller chooses the
 * source and target years. The route walks every ClassGroup in `fromYearId` and
 * looks for a matching group by name in `toYearId`. If found, all sections under
 * the source group's classes get students moved to the target. If a target
 * doesn't exist, the API returns a list of missing pairs so the UI can prompt
 * to create them first.
 */
export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    if (parsed.data.fromYearId === parsed.data.toYearId) {
      return NextResponse.json({ ok: false, error: "Source and target year must differ" }, { status: 400 });
    }

    const result = await withRls(user.id, async (tx) => {
      const [fromYear, toYear] = await Promise.all([
        tx.academicYear.findFirst({ where: { id: parsed.data.fromYearId, institutionId: institution.id } }),
        tx.academicYear.findFirst({ where: { id: parsed.data.toYearId, institutionId: institution.id } }),
      ]);
      if (!fromYear || !toYear) throw new Error("Academic year not found");

      // Map class groups by name across years
      const [fromGroups, toGroups] = await Promise.all([
        tx.classGroup.findMany({ where: { institutionId: institution.id, academicYearId: fromYear.id }, include: { sections: true } }),
        tx.classGroup.findMany({ where: { institutionId: institution.id, academicYearId: toYear.id }, include: { sections: true } }),
      ]);
      const toByName = new Map(toGroups.map(g => [g.name.toLowerCase(), g]));

      const mapping: MapEntry[] = [];
      const missingTargets: string[] = [];

      for (const from of fromGroups) {
        const to = toByName.get(from.name.toLowerCase());
        if (!to) { missingTargets.push(from.name); continue; }

        // Pair sections by `section` letter — fall back to the first section in the target group
        const toBySection = new Map<string, string>();
        for (const s of to.sections) {
          toBySection.set((s.section ?? "").toLowerCase(), s.id);
        }
        for (const s of from.sections) {
          const matched = toBySection.get((s.section ?? "").toLowerCase()) ?? to.sections[0]?.id;
          if (!matched) continue;
          mapping.push({ fromClassId: s.id, toClassId: matched, promote: true });
        }
      }

      if (missingTargets.length > 0 && !parsed.data.dryRun) {
        // Surface missing targets — UI will prompt admin to create them
      }

      // Build a preview of student counts per source class
      const preview: Array<{ fromClassId: string; toClassId: string; studentCount: number }> = [];
      let totalStudents = 0;
      for (const m of mapping) {
        const count = await tx.student.count({
          where: { institutionId: institution.id, classId: m.fromClassId, status: "ACTIVE" },
        });
        preview.push({ ...m, studentCount: count });
        totalStudents += count;
      }

      if (parsed.data.dryRun) {
        return {
          dryRun: true,
          mapping: preview,
          missingTargets,
          totalStudents,
        };
      }

      // Perform the moves in a single transaction. Students keep their identity
      // (id stays the same), just classId is updated.
      let moved = 0;
      for (const m of mapping) {
        const r = await tx.student.updateMany({
          where: { institutionId: institution.id, classId: m.fromClassId, status: "ACTIVE" },
          data: { classId: m.toClassId },
        });
        moved += r.count;
      }

      return { dryRun: false, moved, missingTargets, mapping: preview };
    });

    if (!parsed.data.dryRun) {
      try {
        await prismaAdmin.auditLog.create({
          data: {
            actorUserId: user.id, institutionId: institution.id,
            action: "academicYear.promote",
            targetId: parsed.data.toYearId,
            meta: { fromYearId: parsed.data.fromYearId, toYearId: parsed.data.toYearId, moved: (result as { moved?: number }).moved ?? 0 },
          },
        });
      } catch { /* ignore */ }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "Promotion could not be completed" }, { status: 400 });
  }
}
