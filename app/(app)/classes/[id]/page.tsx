import { notFound } from "next/navigation";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { SectionClient } from "./section-client";

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, institution, membership } = await requireInstitution();

  const data = await withRls(user.id, async (tx) => {
    const cls = await tx.class.findFirst({
      where: { id, institutionId: institution.id },
      include: {
        classGroup: {
          select: {
            id: true, name: true,
            classHead: { select: { id: true, fullName: true } },
          },
        },
        sectionTeacher: {
          select: { id: true, fullName: true, phone: true, email: true, designation: true, qualification: true },
        },
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, fullName: true, gender: true, admissionNo: true },
          orderBy: { fullName: "asc" },
        },
      },
    });
    if (!cls) return null;

    const staff = await tx.membership.findMany({
      where: { institutionId: institution.id, revokedAt: null, role: { in: ["OWNER", "ADMIN", "TEACHER"] } },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { role: "asc" },
    });

    return { cls, staff: staff.map(m => ({ id: m.user.id, fullName: m.user.fullName, role: m.role })) };
  });

  if (!data) notFound();

  const { cls, staff } = data;

  return (
    <SectionClient
      section={{
        id: cls.id,
        name: cls.classGroup?.name ?? cls.name,
        section: cls.section,
        academicYear: cls.academicYear,
        classHeadName: cls.classGroup?.classHead?.fullName ?? null,
        sectionLeaderId: cls.sectionLeaderId,
        girlsLeaderId: cls.girlsLeaderId,
        boysLeaderId: cls.boysLeaderId,
      }}
      teacher={cls.sectionTeacher}
      students={cls.students}
      staff={staff}
      canManage={["OWNER", "ADMIN"].includes(membership.role)}
    />
  );
}
