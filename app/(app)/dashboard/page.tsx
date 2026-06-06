import Link from "next/link";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { todayIST } from "@/lib/format/date";
import { Users, BookOpen, AlertCircle, UserPlus, TrendingUp, Clock } from "lucide-react";

function greeting(): string {
  const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const { user, institution, membership } = await requireInstitution();
  const today   = todayIST();
  const todayDt = new Date(today);

  // Month window for fees
  const [y, m] = today.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 0);

  const data = await withRls(user.id, async (tx) => {
    const isTeacher = membership.role === "TEACHER";

    const [
      totalStudents,
      activeStudents,
      unmarkedToday,
      overdueInvoices,
      feeCollected,
      feeOutstanding,
      hotLeads,
      followupsDue,
      feeByMonth,
    ] = await Promise.all([
      // total students
      tx.student.count({ where: { institutionId: institution.id } }),
      // active students
      tx.student.count({ where: { institutionId: institution.id, status: "ACTIVE" } }),
      // classes that have NOT had attendance marked today
      tx.class.count({
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
      }),
      // overdue invoices count
      tx.invoice.count({
        where: {
          institutionId: institution.id,
          status: { in: ["UNPAID", "PARTIAL"] },
          dueDate: { lt: todayDt },
        },
      }),
      // this month collected
      tx.payment.aggregate({
        where: {
          institutionId: institution.id,
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      // outstanding this month
      tx.invoice.aggregate({
        where: {
          institutionId: institution.id,
          status: { in: ["UNPAID", "PARTIAL"] },
          periodStart: { gte: monthStart },
          periodEnd: { lte: monthEnd },
        },
        _sum: { amountDue: true, amountPaid: true },
      }),
      // hot leads (active)
      isTeacher ? Promise.resolve(0) : tx.lead.count({
        where: {
          institutionId: institution.id,
          priority: "HOT",
          stage: { notIn: ["CONVERTED", "LOST"] },
        },
      }),
      // follow-ups due today or overdue
      isTeacher ? Promise.resolve(0) : tx.lead.count({
        where: {
          institutionId: institution.id,
          nextFollowupAt: { lte: todayDt },
          stage: { notIn: ["CONVERTED", "LOST"] },
        },
      }),
      // fee collection last 6 months — one number per month
      isTeacher ? Promise.resolve([]) : tx.$queryRaw<{ month: string; total: bigint }[]>`
        SELECT to_char(date_trunc('month', "paidAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
               SUM(amount) AS total
        FROM payments
        WHERE "institutionId" = ${institution.id}
          AND "paidAt" >= ${new Date(y, m - 7, 1)}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const outstanding = (feeOutstanding._sum.amountDue ?? 0) - (feeOutstanding._sum.amountPaid ?? 0);

    // Format trend as array of { month, total }
    const trend = (feeByMonth as { month: string; total: bigint }[]).map(r => ({
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

  const maxTrend = Math.max(...data.trend.map(t => t.total), 1);
  const MONTHS: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold">{greeting()}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{institution.name}</p>
      </div>

      {/* Action center — only show issues that exist */}
      {(data.unmarkedToday > 0 || data.overdueInvoices > 0 || data.followupsDue > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action needed</p>
          <div className="space-y-2">
            {data.unmarkedToday > 0 && (
              <Link
                href="/attendance"
                className="flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-xl p-3.5 hover:bg-amber-100 transition-colors"
              >
                <BookOpen className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900">{data.unmarkedToday} class{data.unmarkedToday > 1 ? "es" : ""} not marked today</p>
                  <p className="text-xs text-amber-700">Mark attendance now</p>
                </div>
                <span className="text-amber-600 text-xs">→</span>
              </Link>
            )}

            {data.overdueInvoices > 0 && !data.isTeacher && (
              <Link
                href="/fees?status=OVERDUE"
                className="flex items-center gap-3 border border-red-200 bg-red-50 rounded-xl p-3.5 hover:bg-red-100 transition-colors"
              >
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900">{data.overdueInvoices} overdue invoice{data.overdueInvoices > 1 ? "s" : ""}</p>
                  <p className="text-xs text-red-700">View and collect</p>
                </div>
                <span className="text-red-600 text-xs">→</span>
              </Link>
            )}

            {data.followupsDue > 0 && !data.isTeacher && (
              <Link
                href="/admissions"
                className="flex items-center gap-3 border border-blue-200 bg-blue-50 rounded-xl p-3.5 hover:bg-blue-100 transition-colors"
              >
                <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900">{data.followupsDue} follow-up{data.followupsDue > 1 ? "s" : ""} due</p>
                  <p className="text-xs text-blue-700">Check admissions pipeline</p>
                </div>
                <span className="text-blue-600 text-xs">→</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* KPI grid */}
      {!data.isTeacher && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs">Active students</span>
            </div>
            <p className="text-2xl font-bold">{data.activeStudents}</p>
            <p className="text-xs text-muted-foreground">{data.totalStudents} total</p>
          </div>

          <div className="border rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Collected this month</span>
            </div>
            <p className="text-xl font-bold text-green-700">{formatINR(data.feeCollected)}</p>
            {data.feeOutstanding > 0 && (
              <p className="text-xs text-amber-600">{formatINR(data.feeOutstanding)} pending</p>
            )}
          </div>

          <div className="border rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserPlus className="h-4 w-4" />
              <span className="text-xs">Hot leads</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{data.hotLeads}</p>
            <p className="text-xs text-muted-foreground">in pipeline</p>
          </div>

          <div className="border rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">Overdue fees</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{data.overdueInvoices}</p>
            <p className="text-xs text-muted-foreground">invoices</p>
          </div>
        </div>
      )}

      {/* Teacher stats */}
      {data.isTeacher && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs">Active students</span>
            </div>
            <p className="text-2xl font-bold">{data.activeStudents}</p>
          </div>
          <div className="border rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span className="text-xs">Classes unmarked</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{data.unmarkedToday}</p>
            <p className="text-xs text-muted-foreground">today</p>
          </div>
        </div>
      )}

      {/* Fee collection trend chart */}
      {data.trend.length > 0 && !data.isTeacher && (
        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold">Fee collection trend</p>
          <div className="flex items-end gap-1.5 h-24">
            {data.trend.map(t => {
              const pct  = Math.round((t.total / maxTrend) * 100);
              const mo   = t.month.split("-")[1];
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

      {/* Quick links */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick actions</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/attendance" className="border rounded-xl p-3.5 text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" /> Attendance
          </Link>
          {!data.isTeacher && (
            <>
              <Link href="/fees" className="border rounded-xl p-3.5 text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" /> Fees
              </Link>
              <Link href="/students/new" className="border rounded-xl p-3.5 text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" /> Add student
              </Link>
              <Link href="/admissions" className="border rounded-xl p-3.5 text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" /> Admissions
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
