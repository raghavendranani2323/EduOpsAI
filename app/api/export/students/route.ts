import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { csvResponse } from "@/lib/export/csv";
import { writeAuditEvent } from "@/lib/audit/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { ApiError, errorResponse } from "@/lib/api/errors";

export async function GET() {
  const { user, institution, membership } = await requireApiInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "export.students",
      outcome: "denied",
      meta: { role: membership.role },
    });
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    await enforceRateLimit({
      scope: "export-students",
      subject: `${institution.id}:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    throw err;
  }

  const rows = await withRls(user.id, (tx) =>
    tx.student.findMany({
      where: { institutionId: institution.id },
      include: {
        class: { select: { name: true, section: true } },
        guardians: {
          where: { isPrimary: true },
          include: { guardian: { select: { fullName: true, phone: true } } },
          take: 1,
        },
      },
      orderBy: [
        { class: { name: "asc" } },
        { admissionNo: { sort: "asc", nulls: "last" } },
        { fullName: "asc" },
      ],
    }),
  );

  const records = rows.map(s => {
    const g = s.guardians[0]?.guardian;
    return {
      "Admission No":   s.admissionNo ?? "",
      "Full Name":      s.fullName,
      "Gender":         s.gender ?? "",
      "DOB":            s.dob ? s.dob.toISOString().split("T")[0] : "",
      "Class":          s.class ? (s.class.section ? `${s.class.name}-${s.class.section}` : s.class.name) : "",
      "Status":         s.status,
      "Primary Guardian": g?.fullName ?? "",
      "Guardian Phone":  g?.phone ?? "",
      "Created":        s.createdAt.toISOString().split("T")[0],
    };
  });

  await writeAuditEvent({
    actorUserId: user.id,
    institutionId: institution.id,
    action: "export.students",
    outcome: "success",
    meta: { rowCount: records.length },
  });

  return csvResponse(records, `students-${institution.name.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.csv`);
}
