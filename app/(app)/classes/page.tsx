import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";
import { ClassesClient } from "./classes-client";
import { defaultAcademicYearName } from "@/lib/tenant/academic-year";

export default async function ClassesPage() {
  const { user, institution, membership } = await requireInstitution();
  const isTeacher = membership.role === "TEACHER";

  const { classes, staff, students, emptyGroups, academicYears, activeYear } = await withRls(user.id, async (tx) => {
    // Teachers only see classes they handle (section teacher or class head)
    const allowedIds = await getTeacherClassIds(tx, user.id, institution.id, membership.role);

    const classes = await tx.class.findMany({
      where: {
        institutionId: institution.id,
        ...(allowedIds ? { id: { in: allowedIds.length ? allowedIds : ["__none__"] } } : {}),
      },
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
    const emptyGroups = isTeacher ? [] : await tx.classGroup.findMany({
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
      include: {
        user: {
          select: { id: true, fullName: true, phone: true, email: true, designation: true, qualification: true },
        },
      },
      orderBy: { role: "asc" },
    });
    const students = await tx.student.findMany({
      where: { institutionId: institution.id, status: "ACTIVE" },
      select: { id: true, fullName: true, gender: true, classId: true },
      orderBy: { fullName: "asc" },
    });

    const academicYears = await tx.academicYear.findMany({
      where: { institutionId: institution.id },
      orderBy: { name: "desc" },
      select: { id: true, name: true, isActive: true },
    });
    const activeYear = academicYears.find(y => y.isActive) ?? null;

    return {
      classes,
      emptyGroups,
      staff: staff.map((m) => ({
        id: m.user.id,
        fullName: m.user.fullName,
        role: m.role,
        phone: m.user.phone,
        email: m.user.email,
        designation: m.user.designation,
        qualification: m.user.qualification,
      })),
      students,
      academicYears,
      activeYear,
    };
  });

  return (
    <ClassesClient
      classes={classes}
      emptyGroups={emptyGroups}
      staff={staff}
      students={students}
      institutionType={institution.type}
      academicYears={academicYears}
      activeAcademicYearId={activeYear?.id ?? null}
      defaultYearName={defaultAcademicYearName()}
      canManage={!isTeacher}
    />
  );
}
