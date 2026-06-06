import { notFound } from "next/navigation";
import Link from "next/link";
import { GraduationCap, CalendarCheck, Wallet, BookOpen, Megaphone, ChevronRight } from "lucide-react";
import { prismaAdmin } from "@/lib/prisma/admin";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

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
  const presentCount = recentRecords.filter(r => r.status === "PRESENT").length;
  const absentCount  = recentRecords.filter(r => r.status === "ABSENT").length;
  const lateCount    = recentRecords.filter(r => r.status === "LATE").length;
  const attRate = recentRecords.length > 0
    ? Math.round((presentCount / recentRecords.length) * 100)
    : null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-5">
        <div className="flex items-center gap-2 text-xs opacity-90 mb-2">
          <GraduationCap className="h-4 w-4" />
          <span>{student.institution.name}</span>
        </div>
        <h1 className="text-xl font-bold">{student.fullName}</h1>
        <p className="text-sm opacity-90 mt-0.5">
          {student.class?.name ?? "No class"}
          {student.admissionNo ? ` · ${student.admissionNo}` : ""}
        </p>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4 pb-12">
        {/* Snapshot */}
        <section className="grid grid-cols-2 gap-2">
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{attRate !== null ? `${attRate}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">This month attendance</p>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${totalDue > 0 ? "text-amber-700" : "text-green-700"}`}>
              {formatINR(totalDue)}
            </p>
            <p className="text-xs text-muted-foreground">Outstanding</p>
          </div>
        </section>

        {/* Attendance */}
        <Section icon={CalendarCheck} title="Attendance · this month">
          {recentRecords.length === 0 ? (
            <Empty>No attendance records yet this month.</Empty>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                <div><span className="font-bold text-green-700">{presentCount}</span> present</div>
                <div><span className="font-bold text-red-700">{absentCount}</span> absent</div>
                <div><span className="font-bold text-amber-700">{lateCount}</span> late</div>
              </div>
              <ul className="space-y-1">
                {recentRecords.slice(0, 7).map(r => (
                  <li key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0">
                    <span>{formatDate(r.session.sessionDate.toISOString().split("T")[0])}</span>
                    <span className={
                      r.status === "PRESENT"  ? "text-green-700 font-medium" :
                      r.status === "ABSENT"   ? "text-red-700 font-medium"   :
                      r.status === "LATE"     ? "text-amber-700 font-medium" :
                                                "text-orange-700 font-medium"
                    }>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase().replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        {/* Fees */}
        <Section icon={Wallet} title="Outstanding fees">
          {invoices.length === 0 ? (
            <Empty>No outstanding fees. Thank you!</Empty>
          ) : (
            <ul className="space-y-2">
              {invoices.map(inv => (
                <li key={inv.id} className="flex items-center justify-between border rounded-lg p-2.5">
                  <div className="text-sm">
                    <p className="font-medium">{formatINR(inv.amountDue - inv.amountPaid)}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate.toISOString().split("T")[0])}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    inv.dueDate < today ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {inv.dueDate < today ? "Overdue" : inv.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Homework */}
        <Section icon={BookOpen} title="Homework">
          {homework.length === 0 ? (
            <Empty>No homework posted recently.</Empty>
          ) : (
            <ul className="space-y-2">
              {homework.map(h => (
                <li key={h.id} className="border rounded-lg p-2.5">
                  <p className="text-sm font-medium">{h.title}</p>
                  {h.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{h.description}</p>}
                  {h.dueDate && (
                    <p className="text-xs text-muted-foreground mt-1">Due {formatDate(h.dueDate.toISOString().split("T")[0])}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Notices */}
        <Section icon={Megaphone} title="Notices">
          {notices.length === 0 ? (
            <Empty>No notices yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {notices.map(n => (
                <li key={n.id}>
                  <Link
                    href={`/p/${token}/notice/${n.id}`}
                    className="flex items-center gap-2 border rounded-lg p-2.5 hover:bg-muted/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
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
          You're viewing a secure private link for {student.fullName}.
          <br />
          Do not share with anyone outside the family.
        </footer>
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border rounded-xl p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground text-center py-3">{children}</p>;
}
