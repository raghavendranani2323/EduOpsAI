import { notFound } from "next/navigation";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";
import { SectionClient } from "./section-client";

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, institution, membership } = await requireInstitution();

  const data = await withRls(user.id, async (tx) => {
    // Teachers can only open sections they handle
    const allowedIds = await getTeacherClassIds(tx, user.id, institution.id, membership.role);
    if (allowedIds && !allowedIds.includes(id)) return null;

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
        sectionLeader: { select: { id: true, fullName: true } },
        girlsLeader: { select: { id: true, fullName: true } },
        boysLeader: { select: { id: true, fullName: true } },
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

    // Everything the assigned teacher handles (heads can run multiple classes,
    // one teacher can run multiple sections)
    let assignments: string[] = [];
    let teacherRole: string | undefined;
    if (cls.sectionTeacherId) {
      const tid = cls.sectionTeacherId;
      const [headGroups, sections] = await Promise.all([
        tx.classGroup.findMany({
          where: { institutionId: institution.id, classHeadId: tid },
          select: { name: true },
          orderBy: { name: "asc" },
        }),
        tx.class.findMany({
          where: { institutionId: institution.id, sectionTeacherId: tid },
          select: { name: true, section: true, classGroup: { select: { name: true } } },
          orderBy: [{ name: "asc" }, { section: "asc" }],
        }),
      ]);
      assignments = [
        ...headGroups.map(g => `Class Head · ${g.name}`),
        ...sections.map(s => `Class Teacher · ${s.classGroup?.name ?? s.name}${s.section ? ` — Section ${s.section}` : ""}`),
      ];
      teacherRole = staff.find(m => m.user.id === tid)?.role;
    }

    return { cls, assignments, teacherRole, staff: staff.map(m => ({ id: m.user.id, fullName: m.user.fullName, role: m.role })) };
  });

  if (!data) notFound();

  const { cls, staff, assignments, teacherRole } = data;

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
        sectionLeaderName: cls.sectionLeader?.fullName ?? null,
        girlsLeaderName: cls.girlsLeader?.fullName ?? null,
        boysLeaderName: cls.boysLeader?.fullName ?? null,
      }}
      teacher={cls.sectionTeacher}
      teacherRole={teacherRole}
      teacherAssignments={assignments}
      students={cls.students}
      staff={staff}
      canManage={["OWNER", "ADMIN"].includes(membership.role)}
    />
  );
}
