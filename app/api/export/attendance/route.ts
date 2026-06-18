import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { csvResponse } from "@/lib/export/csv";
import { writeAuditEvent } from "@/lib/audit/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse } from "@/lib/api/errors";

export async function GET(req: Request) {
  const { user, institution, membership } = await requireApiInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "export.attendance",
      outcome: "denied",
      meta: { role: membership.role },
    });
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    await enforceRateLimit({
      scope: "export-attendance",
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
  const classId = searchParams.get("classId") ?? "";

  let dateFilter = {};
  if (month) {
    const [y, m] = month.split("-").map(Number);
    dateFilter = { sessionDate: { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0) } };
  }

  const rows = await withRls(user.id, (tx) =>
    tx.attendanceRecord.findMany({
      where: {
        session: {
          institutionId: institution.id,
          ...(classId ? { classId } : {}),
          ...dateFilter,
        },
      },
      include: {
        student: { select: { fullName: true, admissionNo: true } },
        session: {
          select: {
            sessionDate: true, sessionLabel: true,
            class: { select: { name: true, section: true } },
          },
        },
      },
      orderBy: [{ session: { sessionDate: "desc" } }, { student: { fullName: "asc" } }],
      take: 50_000,
    }),
  );

  const records = rows.map(r => ({
    "Date":        r.session.sessionDate.toISOString().split("T")[0],
    "Class":       r.session.class ? (r.session.class.section ? `${r.session.class.name}-${r.session.class.section}` : r.session.class.name) : "",
    "Session":     r.session.sessionLabel,
    "Admission":   r.student.admissionNo ?? "",
    "Student":     r.student.fullName,
    "Status":      r.status,
    "Note":        r.note ?? "",
  }));

  await writeAuditEvent({
    actorUserId: user.id,
    institutionId: institution.id,
    action: "export.attendance",
    outcome: "success",
    meta: { rowCount: records.length, month: month || null, classId: classId || null },
  });

  return csvResponse(records, `attendance-${month || "all"}-${new Date().toISOString().split("T")[0]}.csv`);
}
