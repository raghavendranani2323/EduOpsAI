import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTerminology } from "@/lib/i18n/terminology";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";
import { StudentDetailClient } from "./student-detail-client";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, institution } = await requireInstitution();
  const t = getTerminology(institution.type);

  const [student, classes, tags] = await withRls(user.id, async (tx) => {
    const [s, c, tg] = await Promise.all([
      tx.student.findFirst({
        where: { id, institutionId: institution.id },
        include: {
          class: { select: { id: true, name: true } },
          studentTags: { include: { tag: true } },
          guardians: { include: { guardian: true } },
          invoices: {
            orderBy: { dueDate: "desc" },
            take: 12,
            select: { id: true, status: true, amountDue: true, amountPaid: true, dueDate: true, periodStart: true, periodEnd: true },
          },
        },
      }),
      tx.class.findMany({ where: { institutionId: institution.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      tx.tag.findMany({ where: { institutionId: institution.id }, orderBy: { label: "asc" } }),
    ]);
    return [s, c, tg] as const;
  });

  if (!student) notFound();

  const paidCount   = student.invoices.filter(i => i.status === "PAID").length;
  const unpaidCount = student.invoices.filter(i => i.status === "UNPAID").length;
  const totalDue    = student.invoices.reduce((s, i) => s + (i.amountDue - i.amountPaid), 0);

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/students" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{student.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {student.class?.name ?? "No class"}
            {student.admissionNo ? ` · ${student.admissionNo}` : ""}
          </p>
        </div>
        <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${student.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
          {student.status.toLowerCase()}
        </span>
      </div>

      {/* Tags */}
      {student.studentTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {student.studentTags.map(({ tag }) => (
            <span
              key={tag.id}
              className="text-xs rounded-full px-2.5 py-1 font-medium"
              style={{ backgroundColor: tag.color + "22", color: tag.color }}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Basic info */}
      <section className="border rounded-xl divide-y">
        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Gender</span>
          <span className="font-medium capitalize">{student.gender?.toLowerCase() ?? "—"}</span>
        </div>
        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Date of birth</span>
          <span className="font-medium">{student.dob ? formatDate(student.dob) : "—"}</span>
        </div>
        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-muted-foreground">{t.class}</span>
          <span className="font-medium">{student.class?.name ?? "—"}</span>
        </div>
      </section>

      {/* Guardians */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">{t.guardian}</h2>
        {student.guardians.length === 0 && (
          <p className="text-sm text-muted-foreground">No guardian recorded.</p>
        )}
        {student.guardians.map(({ guardian, relation, isPrimary }) => (
          <div key={guardian.id} className="flex items-center gap-3 border rounded-xl p-3.5">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{guardian.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{relation}{isPrimary ? " · primary" : ""}</p>
            </div>
            <a
              href={`tel:${guardian.phone}`}
              className="text-primary text-sm font-medium"
            >
              {formatPhone(guardian.phone)}
            </a>
          </div>
        ))}
      </section>

      {/* Fee summary */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm">Fee summary</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{paidCount}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </div>
          <div className="border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{unpaidCount}</p>
            <p className="text-xs text-muted-foreground">Unpaid</p>
          </div>
          <div className="border rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{formatINR(totalDue)}</p>
            <p className="text-xs text-muted-foreground">Outstanding</p>
          </div>
        </div>

        {student.invoices.slice(0, 5).map(inv => (
          <div key={inv.id} className="flex items-center gap-3 border rounded-lg p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {inv.periodStart ? formatDate(inv.periodStart) : formatDate(inv.dueDate)}
              </p>
              <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{formatINR(inv.amountDue)}</p>
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${inv.status === "PAID" ? "bg-green-100 text-green-700" : inv.status === "PARTIAL" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                {inv.status.toLowerCase()}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Edit section (client component) */}
      <StudentDetailClient
        student={{
          id: student.id,
          fullName: student.fullName,
          admissionNo: student.admissionNo,
          gender: student.gender,
          dob: student.dob?.toISOString().split("T")[0] ?? null,
          classId: student.classId,
          status: student.status,
          tagIds: student.studentTags.map(st => st.tagId),
        }}
        classes={classes}
        tags={tags}
        terminology={t}
      />
    </div>
  );
}
