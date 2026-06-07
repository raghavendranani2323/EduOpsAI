import Link from "next/link";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { todayIST } from "@/lib/format/date";
import { Users, BookOpen, AlertCircle, UserPlus, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

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

  const [y, m] = today.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);

  const data = await withRls(user.id, async (tx) => {
    const isTeacher = membership.role === "TEACHER";

    // Keep these sequential: pg warns against concurrent queries on the same transaction client.
    const totalStudents = await tx.student.count({ where: { institutionId: institution.id } });
    const activeStudents = await tx.student.count({ where: { institutionId: institution.id, status: "ACTIVE" } });
    const unmarkedToday = await tx.class.count({
      where: {
        institutionId: institution.id,
        NOT: {
          sessions: {
            some: {
              sessionDate: todayDt,
              sessionLabel: "morning",
            },
          },
        },
      },
    });
    const overdueInvoices = await tx.invoice.count({
      where: {
        institutionId: institution.id,
        status: { in: ["UNPAID", "PARTIAL"] },
        dueDate: { lt: todayDt },
      },
    });
    const feeCollected = await tx.payment.aggregate({
      where: {
        institutionId: institution.id,
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });
    const feeOutstanding = await tx.invoice.aggregate({
      where: {
        institutionId: institution.id,
        status: { in: ["UNPAID", "PARTIAL"] },
        periodStart: { gte: monthStart },
        periodEnd: { lte: monthEnd },
      },
      _sum: { amountDue: true, amountPaid: true },
    });
    const hotLeads = isTeacher ? 0 : await tx.lead.count({
      where: {
        institutionId: institution.id,
        priority: "HOT",
        stage: { notIn: ["CONVERTED", "LOST"] },
      },
    });
    const followupsDue = isTeacher ? 0 : await tx.lead.count({
      where: {
        institutionId: institution.id,
        nextFollowupAt: { lte: todayDt },
        stage: { notIn: ["CONVERTED", "LOST"] },
      },
    });
    const feeByMonth = isTeacher ? [] : await tx.$queryRaw<{ month: string; total: bigint }[]>`
      SELECT to_char(date_trunc('month', "paidAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
             SUM(amount) AS total
      FROM payments
      WHERE "institutionId" = ${institution.id}
        AND "paidAt" >= ${new Date(y, m - 7, 1)}
      GROUP BY 1
      ORDER BY 1
    `;

    const outstanding = (feeOutstanding._sum.amountDue ?? 0) - (feeOutstanding._sum.amountPaid ?? 0);
    const trend = feeByMonth.map((r) => ({
      month: r.month,
      total: Number(r.total),
    }));

    return {
      totalStudents,
      activeStudents,
      unmarkedToday,
      overdueInvoices,
      feeCollected: feeCollected._sum.amount ?? 0,
      feeOutstanding: outstanding,
      hotLeads,
      followupsDue,
      trend,
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
    <div className="p-4 md:p-6 space-y-5 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting()}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{institution.name}</p>
      </div>

      {(data.unmarkedToday > 0 || data.overdueInvoices > 0 || data.followupsDue > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action needed</p>
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
        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold">Fee collection trend</p>
          <div className="flex items-end gap-1.5 h-24">
            {data.trend.map((t) => {
              const pct = Math.round((t.total / maxTrend) * 100);
              const mo = t.month.split("-")[1];
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-primary/15 rounded-sm relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                    <div className="absolute inset-x-0 bottom-0 bg-primary rounded-sm" style={{ height: `${Math.max(pct, 4)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{MONTHS[mo]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick actions</p>
        <div className="grid grid-cols-2 gap-2">
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
  amber: "border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 text-amber-900 dark:text-amber-200",
  red:   "border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 text-red-900 dark:text-red-200",
  blue:  "border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/30 text-blue-900 dark:text-blue-200",
} as const;

function ActionLink({ href, icon: Icon, title, subtitle, tone }: { href: string; icon: React.ElementType; title: string; subtitle: string; tone: keyof typeof TONE_CLASSES }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 border rounded-xl p-3.5 transition-colors active:scale-[0.99] ${TONE_CLASSES[tone]}`}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-80" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-80">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
    </Link>
  );
}

function Kpi({ icon: Icon, label, value, hint, valueClass }: { icon: React.ElementType; label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums truncate ${valueClass ?? ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href} className="border rounded-xl p-3.5 text-sm font-medium hover:bg-muted transition-colors active:scale-[0.98] flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" /> {label}
    </Link>
  );
}
