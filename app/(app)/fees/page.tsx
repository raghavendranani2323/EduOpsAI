import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { todayIST } from "@/lib/format/date";
import { FeesClient } from "./fees-client";

const PAGE_SIZE = 50;

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; classId?: string; month?: string; q?: string; cursor?: string }>;
}) {
  const { user, institution } = await requireInstitution();
  const sp     = await searchParams;
  const today  = todayIST();

  const status  = sp.status  ?? "ALL";
  const classId = sp.classId ?? "";
  const month   = sp.month   ?? today.slice(0, 7); // YYYY-MM
  const q       = sp.q?.trim() ?? "";
  const cursor  = sp.cursor  ?? "";

  const [year, mon] = month.split("-").map(Number);
  const periodStart = new Date(year, mon - 1, 1);
  const periodEnd   = new Date(year, mon, 0);
  const todayDate   = new Date(today);

  const { invoices, classes, summary, total } = await withRls(user.id, async (tx) => {
    // Build where imperatively so TypeScript can infer include types correctly
    const where: Prisma.InvoiceWhereInput = {
      institutionId: institution.id,
      periodStart: { gte: periodStart },
      periodEnd:   { lte: periodEnd },
    };
    if (classId) where.student = { classId };
    if (q) where.student       = { ...where.student as object, fullName: { contains: q, mode: "insensitive" } };
    if (status === "OVERDUE") {
      where.status  = { in: ["UNPAID", "PARTIAL"] };
      where.dueDate = { lt: todayDate };
    } else if (status !== "ALL") {
      where.status = status as "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";
    }

    const summaryWhere: Prisma.InvoiceWhereInput = {
      institutionId: institution.id,
      periodStart: { gte: periodStart },
      periodEnd:   { lte: periodEnd },
    };

    const rows = await tx.invoice.findMany({
      where,
      include: {
        student: {
          select: { id: true, fullName: true, admissionNo: true, class: { select: { name: true } } },
        },
        payments: { select: { amount: true, mode: true, paidAt: true }, orderBy: { paidAt: "desc" }, take: 1 },
      },
      orderBy: { dueDate: "asc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const [count, summaryData, allClasses, overdueCount] = await Promise.all([
      tx.invoice.count({ where }),
      tx.invoice.groupBy({
        by: ["status"],
        where: summaryWhere,
        _sum: { amountDue: true, amountPaid: true },
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      tx.invoice.count({
        where: {
          institutionId: institution.id,
          status: { in: ["UNPAID", "PARTIAL"] },
          dueDate: { lt: todayDate },
        },
      }),
    ]);

    const hasMore    = rows.length > PAGE_SIZE;
    const page       = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    let collected = 0, outstanding = 0;
    summaryData.forEach(g => {
      if (g.status === "PAID") collected += g._sum.amountPaid ?? 0;
      if (g.status === "UNPAID" || g.status === "PARTIAL") {
        outstanding += (g._sum.amountDue ?? 0) - (g._sum.amountPaid ?? 0);
      }
    });

    return {
      invoices: page.map(inv => ({
        id:          inv.id,
        amountDue:   inv.amountDue,
        amountPaid:  inv.amountPaid,
        status:      inv.status,
        dueDate:     inv.dueDate.toISOString().split("T")[0],
        periodStart: inv.periodStart?.toISOString().split("T")[0] ?? null,
        student: {
          id:          inv.student.id,
          fullName:    inv.student.fullName,
          admissionNo: inv.student.admissionNo,
          className:   inv.student.class?.name ?? null,
        },
        lastPayment: inv.payments[0]
          ? { amount: inv.payments[0].amount, mode: inv.payments[0].mode, paidAt: inv.payments[0].paidAt.toISOString().split("T")[0] }
          : null,
      })),
      nextCursor,
      total: count,
      classes: allClasses,
      summary: { collected, outstanding, overdueCount },
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fees</h1>
        <div className="flex gap-2">
          <Link
            href="/fees/generate"
            className="flex items-center gap-1.5 border rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-muted transition-colors"
          >
            Generate
          </Link>
          <Link
            href="/fees/plans"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]"
          >
            Plans
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-green-700">{formatINR(summary.collected)}</p>
          <p className="text-xs text-muted-foreground">Collected</p>
        </div>
        <div className="border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-amber-700">{formatINR(summary.outstanding)}</p>
          <p className="text-xs text-muted-foreground">Outstanding</p>
        </div>
        <div className="border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{summary.overdueCount}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
      </div>

      <FeesClient
        invoices={invoices}
        classes={classes}
        total={total}
        nextCursor={cursor}
        currentFilters={{ status, classId, month, q }}
      />
    </div>
  );
}
