import { notFound } from "next/navigation";
import Link from "next/link";
import { GraduationCap, CalendarCheck, Wallet, BookOpen, Megaphone, ChevronRight } from "lucide-react";
import { prismaAdmin } from "@/lib/prisma/admin";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ParentPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 12) notFound();

  const student = await prismaAdmin.student.findUnique({
    where: { portalToken: token },
    include: {
      class:       { select: { name: true } },
      institution: { select: { name: true, type: true } },
      guardians:   { include: { guardian: { select: { fullName: true, phone: true } } }, take: 1 },
    },
  });
  if (!student) notFound();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [recentRecords, invoices, homework, notices] = await Promise.all([
    prismaAdmin.attendanceRecord.findMany({
      where: { studentId: student.id, session: { sessionDate: { gte: monthStart } } },
      include: { session: { select: { sessionDate: true } } },
      orderBy: { session: { sessionDate: "desc" } },
      take: 30,
    }),
    prismaAdmin.invoice.findMany({
      where: { studentId: student.id, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    student.classId
      ? prismaAdmin.homework.findMany({
          where: { classId: student.classId },
          orderBy: { dueDate: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    prismaAdmin.notice.findMany({
      where: { institutionId: student.institutionId, audience: { in: ["ALL", "PARENTS"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalDue = invoices.reduce((s, inv) => s + (inv.amountDue - inv.amountPaid), 0);
  const overdueCount = invoices.filter(inv => inv.dueDate < today).length;
  const presentCount = recentRecords.filter(r => r.status === "PRESENT").length;
  const absentCount  = recentRecords.filter(r => r.status === "ABSENT").length;
  const lateCount    = recentRecords.filter(r => r.status === "LATE").length;
  const attRate = recentRecords.length > 0
    ? Math.round((presentCount / recentRecords.length) * 100)
    : null;

  const initials = student.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const guardianPhone = student.guardians[0]?.guardian.phone ?? null;

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      {/* Hero */}
      <header className="relative bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-4 pt-6 pb-8">
        <div className="flex items-center gap-2 text-xs opacity-90 mb-3">
          <GraduationCap className="h-4 w-4" />
          <span className="truncate">{student.institution.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{student.fullName}</h1>
            <p className="text-sm opacity-90 mt-0.5 truncate">
              {student.class?.name ?? "No class"}
              {student.admissionNo ? ` · ${student.admissionNo}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 -mt-6 space-y-4 pb-16">
        {/* Snapshot */}
        <section className="grid grid-cols-2 gap-3">
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-green-700 dark:text-green-300 tabular-nums">
              {attRate !== null ? `${attRate}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Attendance this month</p>
          </Card>
          <Card className="p-4 text-center">
            <p className={`text-3xl font-bold tabular-nums ${totalDue > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300"}`}>
              {formatINR(totalDue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalDue > 0 ? `Outstanding${overdueCount ? ` · ${overdueCount} overdue` : ""}` : "All cleared"}
            </p>
          </Card>
        </section>

        {/* Pay CTA */}
        {totalDue > 0 && (
          <Card className="p-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Pay {formatINR(totalDue)}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">Online payment via Razorpay coming soon. Please contact the school for now.</p>
          </Card>
        )}

        {/* Attendance */}
        <Section icon={CalendarCheck} title="Attendance · this month">
          {recentRecords.length === 0 ? (
            <EmptyState title="No records yet" description="Attendance will appear here once your teacher marks it." />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <Stat label="Present" value={presentCount} variant="success" />
                <Stat label="Absent" value={absentCount} variant="destructive" />
                <Stat label="Late" value={lateCount} variant="warning" />
              </div>
              <ul className="divide-y">
                {recentRecords.slice(0, 7).map(r => {
                  const statusColor =
                    r.status === "PRESENT"  ? "success" :
                    r.status === "ABSENT"   ? "destructive" :
                    r.status === "LATE"     ? "warning" : "warning";
                  return (
                    <li key={r.id} className="flex items-center justify-between text-sm py-2">
                      <span className="text-foreground/80">{formatDate(r.session.sessionDate.toISOString().split("T")[0])}</span>
                      <Badge variant={statusColor}>
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase().replace("_", " ")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>

        {/* Fees */}
        <Section icon={Wallet} title="Outstanding fees">
          {invoices.length === 0 ? (
            <EmptyState title="All cleared" description="Thank you — no outstanding fees." />
          ) : (
            <ul className="space-y-2">
              {invoices.map(inv => (
                <li key={inv.id} className="flex items-center justify-between border rounded-xl p-3">
                  <div className="text-sm min-w-0">
                    <p className="font-semibold tabular-nums">{formatINR(inv.amountDue - inv.amountPaid)}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate.toISOString().split("T")[0])}</p>
                  </div>
                  <Badge variant={inv.dueDate < today ? "destructive" : "warning"}>
                    {inv.dueDate < today ? "Overdue" : inv.status.toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Homework */}
        <Section icon={BookOpen} title="Homework">
          {homework.length === 0 ? (
            <EmptyState title="No homework" description="No assignments posted recently." />
          ) : (
            <ul className="space-y-2">
              {homework.map(h => (
                <li key={h.id} className="border rounded-xl p-3">
                  <p className="text-sm font-semibold">{h.title}</p>
                  {h.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.description}</p>}
                  {h.dueDate && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5 font-medium">
                      Due {formatDate(h.dueDate.toISOString().split("T")[0])}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Notices */}
        <Section icon={Megaphone} title="Notices">
          {notices.length === 0 ? (
            <EmptyState title="No notices" description="Important updates from school will show up here." />
          ) : (
            <ul className="space-y-2">
              {notices.map(n => (
                <li key={n.id}>
                  <Link
                    href={`/p/${token}/notice/${n.id}`}
                    className="flex items-center gap-2 border rounded-xl p-3 hover:bg-muted/40 transition-colors active:scale-[0.99]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">{n.body}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(n.createdAt.toISOString().split("T")[0])}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>


        <footer className="text-center text-xs text-muted-foreground pt-4">
          Private link for {student.fullName}. Do not share outside the family.
        </footer>
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant: "success" | "destructive" | "warning" }) {
  const colors = {
    success: "text-green-700 dark:text-green-300",
    destructive: "text-red-700 dark:text-red-300",
    warning: "text-amber-700 dark:text-amber-300",
  } as const;
  return (
    <div className="border rounded-xl p-2">
      <p className={`text-lg font-bold tabular-nums ${colors[variant]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
