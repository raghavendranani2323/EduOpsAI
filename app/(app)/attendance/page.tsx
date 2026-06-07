import Link from "next/link";
import { CheckCircle2, Circle, BookOpen } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTerminology } from "@/lib/i18n/terminology";
import { todayIST, formatDateLong } from "@/lib/format/date";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type ClassWithAttendance = {
  id: string; name: string; section: string | null;
  _count: { students: number };
  sessions: { id: string; _count: { records: number } }[];
};

export default async function AttendancePage() {
  const { user, institution, membership } = await requireInstitution();
  const t = getTerminology(institution.type);
  const today = todayIST();
  const isTeacher = membership.role === "TEACHER";

  const { classes, scopedToTeacher } = await withRls(user.id, async (tx) => {
    const teacherIds = await getTeacherClassIds(tx, user.id, institution.id, membership.role);
    const scoped = teacherIds !== null;

    const rows = await tx.class.findMany({
      where: {
        institutionId: institution.id,
        ...(teacherIds !== null ? { id: { in: teacherIds.length ? teacherIds : ["__none__"] } } : {}),
      },
      include: {
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        sessions: {
          where: { sessionDate: new Date(today) },
          include: { _count: { select: { records: true } } },
        },
      },
      orderBy: [{ name: "asc" }, { section: "asc" }],
    });
    return { classes: rows, scopedToTeacher: scoped };
  });

  const todayLabel = formatDateLong(today);
  const pendingCount = classes.filter(c => !c.sessions[0]).length;
  const doneCount    = classes.length - pendingCount;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {todayLabel}
          {scopedToTeacher && <span className="ml-2 text-xs">· Your classes only</span>}
        </p>
      </div>

      {classes.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Marked today</p>
            <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300 mt-1">{doneCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Pending</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${pendingCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{pendingCount}</p>
          </Card>
        </div>
      )}

      <div className="space-y-2">
        {classes.map((cls: ClassWithAttendance) => {
          const session  = cls.sessions[0];
          const marked   = !!session;
          const count    = session?._count.records ?? 0;
          const total    = cls._count.students;
          const label    = cls.section ? `${cls.name} – ${cls.section}` : cls.name;

          return (
            <Link
              key={cls.id}
              href={`/attendance/${cls.id}`}
              className="flex items-center gap-3 border border-border rounded-2xl p-4 bg-card hover:bg-muted/50 transition-all active:scale-[0.99] hover:shadow-sm"
            >
              {marked
                ? <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                : <Circle       className="h-6 w-6 text-muted-foreground shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm tracking-tight">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {marked
                    ? `Marked — ${count} / ${total} ${t.students.toLowerCase()}`
                    : `${total} ${t.students.toLowerCase()} · not marked`
                  }
                </p>
              </div>
              <Badge variant={marked ? "success" : "warning"}>{marked ? "Done" : "Pending"}</Badge>
            </Link>
          );
        })}
      </div>

      {classes.length === 0 && (
        scopedToTeacher ? (
          <EmptyState
            icon={BookOpen}
            title="No classes assigned to you"
            description="Ask your school admin to assign you as a Section Class Teacher or Class Head."
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title={`No ${t.classes.toLowerCase()} found`}
            description={`Create a ${t.class.toLowerCase()} first.`}
            action={<Link href="/classes" className="text-primary underline text-sm">Go to classes →</Link>}
          />
        )
      )}

      {isTeacher && classes.length > 0 && (
        <div className="text-center pt-2">
          <p className="text-[11px] text-muted-foreground">
            Showing only your assigned classes. Need access to more? Ask your admin.
          </p>
        </div>
      )}
    </div>
  );
}
