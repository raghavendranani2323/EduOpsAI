import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id: leadId } = await params;
    const body = await req.json() as { classId?: string; admissionNo?: string };

    const student = await withRls(user.id, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: leadId, institutionId: institution.id } });
      if (!lead) throw new Error("Lead not found");
      if (lead.stage === "CONVERTED") throw new Error("Already converted");

      // Create student from lead data
      const s = await tx.student.create({
        data: {
          institutionId: institution.id,
          fullName:      lead.studentName,
          admissionNo:   body.admissionNo?.trim() || null,
          classId:       body.classId || null,
          status:        "ACTIVE",
        },
      });

      // Create guardian
      const guardian = await tx.guardian.create({
        data: {
          institutionId: institution.id,
          fullName:      lead.guardianName,
          phone:         lead.phone,
        },
      });
      await tx.studentGuardian.create({
        data: { studentId: s.id, guardianId: guardian.id, relation: "OTHER", isPrimary: true },
      });

      // Mark lead as converted
      await tx.lead.updateMany({
        where: { id: leadId, institutionId: institution.id },
        data:  { stage: "CONVERTED", convertedToStudentId: s.id },
      });

      return s;
    });

    return NextResponse.json({ ok: true, studentId: student.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
