import Link from "next/link";
import { BookOpen, CheckCircle2, Circle, FileText, Camera, Bell, Calendar, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

interface ClassToday {
  id: string;
  label: string;
  studentCount: number;
  markedCount: number | null;
}

interface Props {
  fullName: string;
  institutionName: string;
  todayLabel: string;
  classesToday: ClassToday[];
  pendingHomeworkCount: number;
  recentNoticesCount: number;
}

export function TeacherDashboard({ fullName, institutionName, todayLabel, classesToday, pendingHomeworkCount, recentNoticesCount }: Props) {
  const unmarked = classesToday.filter(c => c.markedCount === null).length;
  const totalStudents = classesToday.reduce((s, c) => s + c.studentCount, 0);

  const firstName = fullName.split(" ")[0];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl animate-fade-in">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{institutionName}</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Hi, {firstName}</h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <Kpi label="Today" value={String(classesToday.length)} subtitle="classes" />
        <Kpi label="To mark" value={String(unmarked)} subtitle="pending" highlight={unmarked > 0} />
        <Kpi label="Students" value={String(totalStudents)} subtitle="total" />
      </div>

      {/* Today's classes — the main daily-driver card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your classes today</p>
          {classesToday.length > 0 && (
            <Link href="/attendance" className="text-xs text-primary font-semibold hover:underline">
              View all →
            </Link>
          )}
        </div>

        {classesToday.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No classes assigned to you"
            description="Ask your school admin to assign you as a Section Class Teacher or Class Head."
          />
        ) : (
          <div className="space-y-2">
            {classesToday.map(cls => {
              const marked = cls.markedCount !== null;
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
                    <p className="font-semibold text-sm tracking-tight">{cls.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {marked
                        ? `Marked — ${cls.markedCount} / ${cls.studentCount} students`
                        : `${cls.studentCount} student${cls.studentCount === 1 ? "" : "s"} · not marked`}
                    </p>
                  </div>
                  <Badge variant={marked ? "success" : "warning"}>{marked ? "Done" : "Mark"}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickAction href="/homework" icon={Camera} label="Post homework" subtitle="Camera or gallery" />
          <QuickAction href="/notices" icon={Bell} label="Post notice" subtitle="To class or parents" />
          <QuickAction href="/timetable" icon={Calendar} label="Timetable" subtitle="Your schedule" />
          <QuickAction href="/students" icon={FileText} label="Students" subtitle="In your classes" />
        </div>
      </div>

      {/* Activity strip */}
      {(pendingHomeworkCount > 0 || recentNoticesCount > 0) && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Activity</p>
          <div className="space-y-2 text-sm">
            {pendingHomeworkCount > 0 && (
              <Link href="/homework" className="flex items-center justify-between hover:bg-muted -mx-2 px-2 py-1 rounded-lg">
                <span>{pendingHomeworkCount} homework{pendingHomeworkCount === 1 ? "" : ""} posted recently</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {recentNoticesCount > 0 && (
              <Link href="/notices" className="flex items-center justify-between hover:bg-muted -mx-2 px-2 py-1 rounded-lg">
                <span>{recentNoticesCount} new notice{recentNoticesCount === 1 ? "" : "s"} this week</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, subtitle, highlight }: { label: string; value: string; subtitle: string; highlight?: boolean }) {
  return (
    <Card className="p-3.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight mt-1 ${highlight ? "text-amber-700 dark:text-amber-300" : ""}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
    </Card>
  );
}

function QuickAction({ href, icon: Icon, label, subtitle }: { href: string; icon: React.ElementType; label: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all active:scale-[0.98]"
    >
      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-semibold tracking-tight">{label}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </Link>
  );
}
