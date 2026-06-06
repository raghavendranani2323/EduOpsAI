import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

interface ImportRow {
  fullName:      string;
  admissionNo?:  string;
  gender?:       string;
  classId?:      string;
  guardianName?: string;
  guardianPhone?: string;
}

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const { students } = await req.json() as { students: ImportRow[] };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ ok: false, error: "No students provided" }, { status: 400 });
    }

    const rows = students.slice(0, 500).filter(s => s.fullName?.trim());
    let imported = 0;
    let errors   = 0;

    for (const row of rows) {
      try {
        await withRls(user.id, async (tx) => {
          const student = await tx.student.create({
            data: {
              institutionId: institution.id,
              fullName:      row.fullName.trim(),
              admissionNo:   row.admissionNo?.trim() || null,
              gender:        (["MALE", "FEMALE", "OTHER"].includes(row.gender ?? "")) ? row.gender as "MALE" | "FEMALE" | "OTHER" : null,
              classId:       row.classId || null,
            },
          });

          if (row.guardianName?.trim() && row.guardianPhone?.trim()) {
            const g = await tx.guardian.create({
              data: {
                institutionId: institution.id,
                fullName: row.guardianName.trim(),
                phone:    row.guardianPhone.trim(),
              },
            });
            await tx.studentGuardian.create({
              data: { studentId: student.id, guardianId: g.id, isPrimary: true },
            });
          }
        });
        imported++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ ok: true, imported, errors });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
