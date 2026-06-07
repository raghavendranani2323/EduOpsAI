import Link from "next/link";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { todayIST, formatDateLong } from "@/lib/format/date";
import { Users, BookOpen, AlertCircle, UserPlus, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";
import { TeacherDashboard } from "./teacher-dashboard";

function greeting(): string {
  const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const { user, institution, membership } = await requireInstitution();
  const today = todayIST();
  const todayDt = new Date(today);

  // Teacher gets a focused, task-shaped dashboard
  if (membership.role === "TEACHER") {
    const view = await withRls(user.id, async (tx) => {
      const ids = await getTeacherClassIds(tx, user.id, institution.id, "TEACHER") ?? [];
      const classes = await tx.class.findMany({
        where: { institutionId: institution.id, id: { in: ids.length ? ids : ["__none__"] } },
        include: {
          _count: { select: { students: { where: { status: "ACTIVE" } } } },
          sessions: {
            where: { sessionDate: todayDt },
            include: { _count: { select: { records: true } } },
          },
        },
        orderBy: [{ name: "asc" }, { section: "asc" }],
      });
      const weekAgo = new Date(todayDt); weekAgo.setDate(weekAgo.getDate() - 7);
      const [pendingHw, recentNotices] = await Promise.all([
        tx.homework.count({
          where: { institutionId: institution.id, teacherId: user.id, createdAt: { gte: weekAgo } },
        }),
        tx.notice.count({
          where: { institutionId: institution.id, createdAt: { gte: weekAgo } },
        }),
      ]);
      return {
        classesToday: classes.map(c => ({
          id: c.id,
          label: c.section ? `${c.name} – ${c.section}` : c.name,
          studentCount: c._count.students,
          markedCount: c.sessions[0]?._count.records ?? null,
        })),
        pendingHomeworkCount: pendingHw,
        recentNoticesCount: recentNotices,
      };
    });

    // Get teacher's full name from profile
    const profile = await withRls(user.id, (tx) => tx.profile.findUnique({ where: { id: user.id }, select: { fullName: true } }));

    return (
      <TeacherDashboard
        fullName={profile?.fullName ?? "Teacher"}
        institutionName={institution.name}
        todayLabel={formatDateLong(today)}
        classesToday={view.classesToday}
        pendingHomeworkCount={view.pendingHomeworkCount}
        recentNoticesCount={view.recentNoticesCount}
      />
    );
  }

  const [y, m] = today.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);

  const data = await withRls(user.id, async (tx) => {
    const isTeacher = membership.role === "TEACHER";
    const trendStart = new Date(y, m - 7, 1);

    // Single round-trip: all KPIs + the 6-month trend in one query.
    const [agg, feeByMonth] = await Promise.all([
      tx.$queryRaw<Array<{
        total_students: bigint; active_students: bigint;
        unmarked_today: bigint; overdue_invoices: bigint;
        fee_collected: bigint | null; outstanding: bigint | null;
        hot_leads: bigint; followups_due: bigint;
      }>>`
        SELECT
          (SELECT COUNT(*) FROM students WHERE "institutionId" = ${institution.id})::bigint AS total_students,
          (SELECT COUNT(*) FROM students WHERE "institutionId" = ${institution.id} AND status = 'ACTIVE')::bigint AS active_students,
          (SELECT COUNT(*) FROM classes c WHERE c."institutionId" = ${institution.id}
             AND NOT EXISTS (
               SELECT 1 FROM attendance_sessions s
               WHERE s."classId" = c.id AND s."sessionDate" = ${todayDt}::date AND s."sessionLabel" = 'morning'
             ))::bigint AS unmarked_today,
          (SELECT COUNT(*) FROM invoices WHERE "institutionId" = ${institution.id}
             AND status IN ('UNPAID','PARTIAL') AND "dueDate" < ${todayDt})::bigint AS overdue_invoices,
          (SELECT COALESCE(SUM(amount),0) FROM payments WHERE "institutionId" = ${institution.id}
             AND "paidAt" >= ${monthStart} AND "paidAt" <= ${monthEnd})::bigint AS fee_collected,
          (SELECT COALESCE(SUM("amountDue" - "amountPaid"),0) FROM invoices WHERE "institutionId" = ${institution.id}
             AND status IN ('UNPAID','PARTIAL')
             AND "periodStart" >= ${monthStart} AND "periodEnd" <= ${monthEnd})::bigint AS outstanding,
          (CASE WHEN ${isTeacher}::bool THEN 0
             ELSE (SELECT COUNT(*) FROM leads WHERE "institutionId" = ${institution.id}
                     AND priority = 'HOT' AND stage NOT IN ('CONVERTED','LOST'))
           END)::bigint AS hot_leads,
          (CASE WHEN ${isTeacher}::bool THEN 0
             ELSE (SELECT COUNT(*) FROM leads WHERE "institutionId" = ${institution.id}
                     AND "nextFollowupAt" <= ${todayDt} AND stage NOT IN ('CONVERTED','LOST'))
           END)::bigint AS followups_due
      `,
      isTeacher ? Promise.resolve([] as Array<{ month: string; total: bigint }>) : tx.$queryRaw<{ month: string; total: bigint }[]>`
        SELECT to_char(date_trunc('month', "paidAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
               SUM(amount) AS total
        FROM payments
        WHERE "institutionId" = ${institution.id} AND "paidAt" >= ${trendStart}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const row = agg[0];
    return {
      totalStudents:   Number(row.total_students),
      activeStudents:  Number(row.active_students),
      unmarkedToday:   Number(row.unmarked_today),
      overdueInvoices: Number(row.overdue_invoices),
      feeCollected:    Number(row.fee_collected ?? 0),
      feeOutstanding:  Number(row.outstanding ?? 0),
      hotLeads:        Number(row.hot_leads),
      followupsDue:    Number(row.followups_due),
      trend:           feeByMonth.map(r => ({ month: r.month, total: Number(r.total) })),
      isTeacher,
    };
  });

  const maxTrend = Math.max(...data.trend.map((t) => t.total), 1);
  const MONTHS: Record<string, string> = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl animate-fade-in">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{institution.name}</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{greeting()}</h1>
      </div>

      {(data.unmarkedToday > 0 || data.overdueInvoices > 0 || data.followupsDue > 0) && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action needed</p>
          <div className="space-y-2">
            {data.unmarkedToday > 0 && (
              <ActionLink
                href="/attendance"
                icon={BookOpen}
                tone="amber"
                title={`${data.unmarkedToday} class${data.unmarkedToday > 1 ? "es" : ""} not marked today`}
                subtitle="Mark attendance now"
              />
            )}
            {data.overdueInvoices > 0 && !data.isTeacher && (
              <ActionLink
                href="/fees?status=OVERDUE"
                icon={AlertCircle}
                tone="red"
                title={`${data.overdueInvoices} overdue invoice${data.overdueInvoices > 1 ? "s" : ""}`}
                subtitle="View and collect"
              />
            )}
            {data.followupsDue > 0 && !data.isTeacher && (
              <ActionLink
                href="/admissions"
                icon={Clock}
                tone="blue"
                title={`${data.followupsDue} follow-up${data.followupsDue > 1 ? "s" : ""} due`}
                subtitle="Check admissions pipeline"
              />
            )}
          </div>
        </div>
      )}

      {!data.isTeacher && (
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={Users}      label="Active students"      value={String(data.activeStudents)} hint={`${data.totalStudents} total`} />
          <Kpi icon={TrendingUp} label="Collected this month" value={formatINR(data.feeCollected)} hint={data.feeOutstanding > 0 ? `${formatINR(data.feeOutstanding)} pending` : undefined} valueClass="text-green-700 dark:text-green-300 text-xl" />
          <Kpi icon={UserPlus}   label="Hot leads"            value={String(data.hotLeads)} hint="in pipeline" valueClass="text-red-600 dark:text-red-400" />
          <Kpi icon={AlertCircle} label="Overdue fees"         value={String(data.overdueInvoices)} hint="invoices" valueClass="text-destructive" />
        </div>
      )}

      {data.isTeacher && (
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={Users}    label="Active students" value={String(data.activeStudents)} />
          <Kpi icon={BookOpen} label="Classes unmarked" value={String(data.unmarkedToday)} hint="today" valueClass="text-amber-600 dark:text-amber-300" />
        </div>
      )}

      {data.trend.length > 0 && !data.isTeacher && (
        <Card className="p-5">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-sm font-semibold tracking-tight">Fee collection trend</p>
            <p className="text-xs text-muted-foreground">Last 6 months</p>
          </div>
          <div className="flex items-end gap-2 h-28">
            {data.trend.map((t) => {
              const pct = Math.round((t.total / maxTrend) * 100);
              const mo = t.month.split("-")[1];
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-md relative overflow-hidden bg-muted h-full flex items-end">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-primary/80 to-primary"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground tracking-wide">{MONTHS[mo]}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickAction href="/attendance" icon={BookOpen} label="Attendance" />
          {!data.isTeacher && (
            <>
              <QuickAction href="/fees" icon={TrendingUp} label="Fees" />
              <QuickAction href="/students/new" icon={Users} label="Add student" />
              <QuickAction href="/admissions" icon={UserPlus} label="Admissions" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const TONE_CLASSES = {
  amber: {
    wrap: "border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-50/40 dark:from-amber-500/12 dark:to-amber-500/5 dark:border-amber-500/30",
    text: "text-amber-900 dark:text-amber-100",
    iconBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  red: {
    wrap: "border-red-200/70 bg-gradient-to-br from-red-50 to-red-50/40 dark:from-red-500/12 dark:to-red-500/5 dark:border-red-500/30",
    text: "text-red-900 dark:text-red-100",
    iconBg: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  blue: {
    wrap: "border-blue-200/70 bg-gradient-to-br from-blue-50 to-blue-50/40 dark:from-blue-500/12 dark:to-blue-500/5 dark:border-blue-500/30",
    text: "text-blue-900 dark:text-blue-100",
    iconBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
} as const;

function ActionLink({ href, icon: Icon, title, subtitle, tone }: { href: string; icon: React.ElementType; title: string; subtitle: string; tone: keyof typeof TONE_CLASSES }) {
  const c = TONE_CLASSES[tone];
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 border rounded-2xl p-3.5 transition-all active:scale-[0.99] hover:shadow-md ${c.wrap} ${c.text}`}
    >
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs opacity-75 mt-0.5">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

function Kpi({ icon: Icon, label, value, hint, valueClass }: { icon: React.ElementType; label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-[26px] leading-none font-bold tabular-nums tracking-tight truncate ${valueClass ?? ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
    </Card>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-card p-4 text-sm font-semibold hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all active:scale-[0.98] flex items-center gap-3"
    >
      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      {label}
    </Link>
  );
}
