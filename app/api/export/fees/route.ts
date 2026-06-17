import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { csvResponse } from "@/lib/export/csv";
import { writeAuditEvent } from "@/lib/audit/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse } from "@/lib/api/errors";

export async function GET(req: Request) {
  const { user, institution, membership } = await requireApiInstitution();
  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)) {
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "export.fees",
      outcome: "denied",
      meta: { role: membership.role },
    });
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    await enforceRateLimit({
      scope: "export-fees",
      subject: `${institution.id}:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? "";

  let periodFilter = {};
  if (month) {
    const [y, m] = month.split("-").map(Number);
    periodFilter = {
      periodStart: { gte: new Date(y, m - 1, 1) },
      periodEnd:   { lte: new Date(y, m, 0) },
    };
  }

  const rows = await withRls(user.id, (tx) =>
    tx.invoice.findMany({
      where: { institutionId: institution.id, ...periodFilter },
      include: {
        student: { select: { fullName: true, admissionNo: true, class: { select: { name: true, section: true } } } },
        feePlan: { select: { name: true, cadence: true } },
      },
      orderBy: { dueDate: "desc" },
    }),
  );

  const records = rows.map(inv => ({
    "Receipt No":   inv.receiptNumber ?? "",
    "Student":      inv.student.fullName,
    "Admission":    inv.student.admissionNo ?? "",
    "Class":        inv.student.class ? (inv.student.class.section ? `${inv.student.class.name}-${inv.student.class.section}` : inv.student.class.name) : "",
    "Plan":         inv.feePlan?.name ?? "",
    "Period":       inv.periodStart ? `${inv.periodStart.toISOString().split("T")[0]} to ${inv.periodEnd?.toISOString().split("T")[0] ?? ""}` : "",
    "Due Date":     inv.dueDate.toISOString().split("T")[0],
    "Amount":       (inv.amountDue / 100).toFixed(2),
    "Paid":         (inv.amountPaid / 100).toFixed(2),
    "Balance":      ((inv.amountDue - inv.amountPaid) / 100).toFixed(2),
    "Status":       inv.status,
    "Notes":        inv.notes ?? "",
  }));

  await writeAuditEvent({
    actorUserId: user.id,
    institutionId: institution.id,
    action: "export.fees",
    outcome: "success",
    meta: { rowCount: records.length, month: month || null },
  });

  return csvResponse(records, `fees-${month || "all"}-${new Date().toISOString().split("T")[0]}.csv`);
}
