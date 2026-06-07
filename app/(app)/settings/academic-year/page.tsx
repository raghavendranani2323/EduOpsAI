import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { AcademicYearClient } from "./academic-year-client";
import { defaultAcademicYearName } from "@/lib/tenant/academic-year";

export default async function AcademicYearPage() {
  const { user, institution, membership } = await requireInstitution();

  const data = await withRls(user.id, async (tx) => {
    const [years, classCounts, studentCount] = await Promise.all([
      tx.academicYear.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "desc" },
      }),
      tx.class.groupBy({
        by: ["academicYearId"],
        where: { institutionId: institution.id, academicYearId: { not: null } },
        _count: { _all: true },
      }),
      tx.student.count({ where: { institutionId: institution.id, status: "ACTIVE" } }),
    ]);
    const countMap = new Map(classCounts.map(c => [c.academicYearId, c._count._all]));
    return {
      years: years.map(y => ({
        id: y.id,
        name: y.name,
        startsOn: y.startsOn?.toISOString().split("T")[0] ?? null,
        endsOn:   y.endsOn?.toISOString().split("T")[0] ?? null,
        isActive: y.isActive,
        classCount: countMap.get(y.id) ?? 0,
      })),
      studentCount,
    };
  });

  return (
    <AcademicYearClient
      years={data.years}
      studentCount={data.studentCount}
      defaultName={defaultAcademicYearName()}
      canEdit={["OWNER", "ADMIN"].includes(membership.role)}
    />
  );
}
