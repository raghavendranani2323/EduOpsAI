import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { GraduationCap, CalendarCheck, Wallet, BookOpen, Megaphone, ChevronRight, LogOut, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { findChildrenForPhone } from "@/lib/parent/children";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChildSwitcher } from "./child-switcher";
import { ParentSignOut } from "./parent-sign-out";

export const dynamic = "force-dynamic";

const SELECTED_CHILD_COOKIE = "eduops_parent_child";

export default async function ParentDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/parent/login");

  const phone = user.phone ? `+${user.phone}` : null;
  if (!phone) redirect("/parent/login");

  const children = await findChildrenForPhone(phone);
  if (children.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-muted/30 flex flex-col">
        <header className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-4 pt-6 pb-8">
          <div className="flex items-center gap-2 text-xs opacity-90 mb-2">
            <GraduationCap className="h-4 w-4" /> EduOps AI
          </div>
          <h1 className="text-xl font-bold">No children linked</h1>
        </header>
        <main className="flex-1 p-4 max-w-md mx-auto w-full -mt-4">
          <Card className="p-6">
            <EmptyState
              icon={Users}
              title="No children linked to this number"
              description={`Phone ${phone} is not on any guardian record. Please contact your school to update your number.`}
              action={<ParentSignOut />}
            />
          </Card>
        </main>
      </div>
    );
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(SELECTED_CHILD_COOKIE)?.value;
  const child = children.find(c => c.id === selectedId) ?? children[0];

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [recentRecords, invoices, homework, notices] = await Promise.all([
    prismaAdmin.attendanceRecord.findMany({
      where: { studentId: child.id, session: { sessionDate: { gte: monthStart } } },
      include: { session: { select: { sessionDate: true } } },
      orderBy: { session: { sessionDate: "desc" } },
      take: 30,
    }),
    prismaAdmin.invoice.findMany({
      where: { studentId: child.id, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prismaAdmin.student.findUnique({
      where: { id: child.id },
      select: { classId: true, institutionId: true },
    }).then(s => s?.classId
      ? prismaAdmin.homework.findMany({
          where: { classId: s.classId },
          orderBy: { dueDate: "desc" },
          take: 10,
        })
      : []),
    prismaAdmin.student.findUnique({
      where: { id: child.id },
      select: { institutionId: true },
    }).then(s => s
      ? prismaAdmin.notice.findMany({
          where: { institutionId: s.institutionId, audience: { in: ["ALL", "PARENTS"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : []),
  ]);

  const totalDue       = invoices.reduce((s, inv) => s + (inv.amountDue - inv.amountPaid), 0);
  const overdueCount   = invoices.filter(inv => inv.dueDate < today).length;
  const presentCount   = recentRecords.filter(r => r.status === "PRESENT").length;
  const absentCount    = recentRecords.filter(r => r.status === "ABSENT").length;
  const lateCount      = recentRecords.filter(r => r.status === "LATE").length;
  const attRate = recentRecords.length > 0 ? Math.round((presentCount / recentRecords.length) * 100) : null;
  const initials = child.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <header className="relative bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-4 pt-6 pb-8">
        <div className="flex items-center justify-between text-xs opacity-90 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span className="truncate">{child.institutionName}</span>
          </div>
          <ParentSignOut compact />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-lg font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{child.fullName}</h1>
            <p className="text-sm opacity-90 mt-0.5 truncate">
              {child.className ?? "No class"}
              {child.admissionNo ? ` · ${child.admissionNo}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 -mt-6 space-y-4 pb-16">
        {children.length > 1 && <ChildSwitcher children={children} selectedId={child.id} />}

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

        {totalDue > 0 && (
          <Card className="p-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Pay {formatINR(totalDue)}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">Online payment via Razorpay coming soon. Please contact the school for now.</p>
          </Card>
        )}

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
                  const v =
                    r.status === "PRESENT" ? "success" :
                    r.status === "ABSENT" ? "destructive" :
                    "warning";
                  return (
                    <li key={r.id} className="flex items-center justify-between text-sm py-2">
                      <span className="text-foreground/80">{formatDate(r.session.sessionDate.toISOString().split("T")[0])}</span>
                      <Badge variant={v}>{r.status.charAt(0) + r.status.slice(1).toLowerCase().replace("_", " ")}</Badge>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>

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

        <Section icon={Megaphone} title="Notices">
          {notices.length === 0 ? (
            <EmptyState title="No notices" description="Important updates from school will show up here." />
          ) : (
            <ul className="space-y-2">
              {notices.map(n => (
                <li key={n.id}>
                  <Link
                    href={child.portalToken ? `/p/${child.portalToken}/notice/${n.id}` : "#"}
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

        <ParentSignOut block />

        <footer className="text-center text-xs text-muted-foreground pt-2 flex items-center justify-center gap-1">
          <LogOut className="h-3 w-3 opacity-60" />
          Signed in as {phone}
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
