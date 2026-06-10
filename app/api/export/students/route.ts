import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { csvResponse } from "@/lib/export/csv";

export async function GET() {
  const { user, institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
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

  return csvResponse(records, `students-${institution.name.replace(/\s+/g, "_")}-${new Date().toISOString().split("T")[0]}.csv`);
}
