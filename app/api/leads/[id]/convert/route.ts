import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import { writeAuditEvent } from "@/lib/audit/server";
import {
  assertAdmissionNoAvailable,
  assertStudentClass,
  normalizeAdmissionNo,
} from "@/lib/data-integrity/validation";
import { addLeadActivity, findLeadDuplicateSignals } from "@/lib/admissions/crm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_CONVERT_FORBIDDEN", "Admissions are available only to owners and admins");
    const { id: leadId } = await params;
    const body = await req.json() as {
      classId?: string;
      admissionNo?: string;
      existingStudentId?: string;
    };

    const conversion = await withRls(user.id, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: leadId, institutionId: institution.id } });
      if (!lead) throw new ApiError(404, "LEAD_NOT_FOUND", "Lead not found");
      if (lead.stage === "CONVERTED") throw new ApiError(409, "LEAD_ALREADY_CONVERTED", "Lead is already converted");

      if (body.existingStudentId) {
        const existingStudent = await tx.student.findFirst({
          where: { id: body.existingStudentId, institutionId: institution.id },
          select: { id: true },
        });
        if (!existingStudent) throw new ApiError(400, "INVALID_EXISTING_STUDENT", "Selected student is not valid");
        await tx.lead.update({
          where: { id: leadId },
          data: {
            stage: "CONVERTED",
            convertedToStudentId: existingStudent.id,
            convertedAt: new Date(),
          },
        });
        await addLeadActivity(tx, {
          institutionId: institution.id,
          leadId,
          actorUserId: user.id,
          kind: "LINKED_EXISTING",
          meta: { studentId: existingStudent.id },
        });
        return { studentId: existingStudent.id, linkedExisting: true };
      }

      const admissionNo = normalizeAdmissionNo(body.admissionNo);
      await Promise.all([
        assertAdmissionNoAvailable(tx, institution.id, admissionNo),
        assertStudentClass(tx, institution.id, body.classId),
      ]);
      const duplicates = await findLeadDuplicateSignals(tx, institution.id, {
        phone: lead.phone,
        studentName: lead.studentName,
        excludeLeadId: leadId,
      });
      if (duplicates.strongStudentMatch) {
        throw new ApiError(
          409,
          "EXISTING_STUDENT_MATCH",
          `A student named ${duplicates.strongStudentMatch.fullName} already uses this guardian phone`,
        );
      }

      // Create student from lead data
      const s = await tx.student.create({
        data: {
          institutionId: institution.id,
          fullName:      lead.studentName,
          admissionNo,
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
        data:  { stage: "CONVERTED", convertedToStudentId: s.id, convertedAt: new Date() },
      });
      await addLeadActivity(tx, {
        institutionId: institution.id,
        leadId,
        actorUserId: user.id,
        kind: "CONVERTED",
        meta: { studentId: s.id },
      });

      return { studentId: s.id, linkedExisting: false };
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "lead.convert",
      targetId: leadId,
      outcome: "success",
      meta: { studentId: conversion.studentId, linkedExisting: conversion.linkedExisting },
    });
    return NextResponse.json({ ok: true, ...conversion });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to convert lead");
  }
}
