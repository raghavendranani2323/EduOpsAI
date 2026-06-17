import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import { writeAuditEvent } from "@/lib/audit/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_CONVERT_FORBIDDEN", "Admissions are available only to owners and admins");
    const { id: leadId } = await params;
    const body = await req.json() as { classId?: string; admissionNo?: string };

    const student = await withRls(user.id, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: leadId, institutionId: institution.id } });
      if (!lead) throw new ApiError(404, "LEAD_NOT_FOUND", "Lead not found");
      if (lead.stage === "CONVERTED") throw new ApiError(409, "LEAD_ALREADY_CONVERTED", "Lead is already converted");
      if (body.classId) {
        const cls = await tx.class.findFirst({
          where: { id: body.classId, institutionId: institution.id },
          select: { id: true },
        });
        if (!cls) throw new ApiError(400, "INVALID_LEAD_CLASS", "Selected class is not valid");
      }

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

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "lead.convert",
      targetId: leadId,
      outcome: "success",
      meta: { studentId: student.id },
    });
    return NextResponse.json({ ok: true, studentId: student.id });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to convert lead");
  }
}
