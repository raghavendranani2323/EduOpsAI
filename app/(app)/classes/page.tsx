import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { ClassesClient } from "./classes-client";

export default async function ClassesPage() {
  const { user, institution } = await requireInstitution();
  const { classes, staff, students, emptyGroups } = await withRls(user.id, async (tx) => {
    const classes = await tx.class.findMany({
      where: { institutionId: institution.id },
      include: {
        classGroup: {
          include: {
            academicYear: true,
            classHead: { select: { id: true, fullName: true } },
            classLeader: { select: { id: true, fullName: true, classId: true } },
            girlsLeader: { select: { id: true, fullName: true, classId: true } },
            boysLeader: { select: { id: true, fullName: true, classId: true } },
          },
        },
        sectionTeacher: { select: { id: true, fullName: true } },
        sectionLeader: { select: { id: true, fullName: true } },
        girlsLeader: { select: { id: true, fullName: true } },
        boysLeader: { select: { id: true, fullName: true } },
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, fullName: true, gender: true, classId: true },
          orderBy: { fullName: "asc" },
        },
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [{ academicYear: "desc" }, { name: "asc" }, { section: "asc" }],
    });

    // Class groups with NO sections (newly created via /api/class-groups)
    const usedGroupIds = new Set(classes.map(c => c.classGroupId).filter(Boolean) as string[]);
    const emptyGroups = await tx.classGroup.findMany({
      where: {
        institutionId: institution.id,
        ...(usedGroupIds.size > 0 ? { id: { notIn: [...usedGroupIds] } } : {}),
      },
      include: {
        academicYear: true,
        classHead: { select: { id: true, fullName: true } },
        classLeader: { select: { id: true, fullName: true, classId: true } },
        girlsLeader: { select: { id: true, fullName: true, classId: true } },
        boysLeader: { select: { id: true, fullName: true, classId: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    const staff = await tx.membership.findMany({
      where: { institutionId: institution.id, revokedAt: null, role: { in: ["OWNER", "ADMIN", "TEACHER"] } },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { role: "asc" },
    });
    const students = await tx.student.findMany({
      where: { institutionId: institution.id, status: "ACTIVE" },
      select: { id: true, fullName: true, gender: true, classId: true },
      orderBy: { fullName: "asc" },
    });

    return {
      classes,
      emptyGroups,
      staff: staff.map((member) => ({ id: member.user.id, fullName: member.user.fullName, role: member.role })),
      students,
    };
  });

  return (
    <ClassesClient
      classes={classes}
      emptyGroups={emptyGroups}
      staff={staff}
      students={students}
      institutionType={institution.type}
    />
  );
}
