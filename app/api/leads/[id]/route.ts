import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import { z } from "zod";
import {
  addLeadActivity,
  assertLeadOwner,
  findLeadDuplicateSignals,
} from "@/lib/admissions/crm";
import { writeAuditEvent } from "@/lib/audit/server";

const patchSchema = z.object({
  studentName: z.string().min(1).max(200).optional(),
  guardianName: z.string().min(1).max(200).optional(),
  phone: z.string().min(10).max(15).optional(),
  interestedClass: z.string().max(100).nullable().optional(),
  source: z.enum(["WALK_IN", "PHONE", "INSTAGRAM", "WHATSAPP", "REFERRAL", "WEBSITE"]).optional(),
  priority: z.enum(["HOT", "WARM", "COLD"]).optional(),
  stage: z.enum(["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_ATTENDED", "CONVERTED", "LOST"]).optional(),
  nextFollowupAt: z.string().nullable().optional(),
  lastNote: z.string().max(2000).nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  lostReason: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_UPDATE_FORBIDDEN", "Admissions are available only to owners and admins");
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_LEAD_UPDATE", parsed.error.issues[0]?.message ?? "Invalid lead update");
    }
    const body = parsed.data;

    const result = await withRls(user.id, async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { id, institutionId: institution.id },
      });
      if (!existing) throw new ApiError(404, "LEAD_NOT_FOUND", "Lead not found");

      const nextStage = body.stage ?? existing.stage;
      const lostReason = body.lostReason !== undefined
        ? body.lostReason?.trim() || null
        : existing.lostReason;
      if (nextStage === "LOST" && !lostReason) {
        throw new ApiError(400, "LOST_REASON_REQUIRED", "Add a reason before marking this lead lost");
      }
      await assertLeadOwner(tx, institution.id, body.assignedToId);

      const nextStudentName = body.studentName?.trim() ?? existing.studentName;
      const nextPhone = body.phone ?? existing.phone;
      const duplicates = await findLeadDuplicateSignals(tx, institution.id, {
        phone: nextPhone,
        studentName: nextStudentName,
        excludeLeadId: id,
      });

      const updated = await tx.lead.update({
        where: { id },
        data: {
          ...(body.studentName !== undefined ? { studentName: nextStudentName } : {}),
          ...(body.guardianName !== undefined ? { guardianName: body.guardianName.trim() } : {}),
          ...(body.phone !== undefined ? { phone: duplicates.phone } : {}),
          ...(body.interestedClass !== undefined ? { interestedClass: body.interestedClass?.trim() || null } : {}),
          ...(body.source !== undefined ? { source: body.source } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.stage !== undefined ? { stage: body.stage } : {}),
          ...(body.lastNote !== undefined ? { lastNote: body.lastNote?.trim() || null } : {}),
          ...(body.nextFollowupAt !== undefined ? { nextFollowupAt: body.nextFollowupAt ? new Date(body.nextFollowupAt) : null } : {}),
          ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId || null } : {}),
          ...(body.lostReason !== undefined ? { lostReason } : {}),
        },
        include: { assignedTo: { select: { id: true, fullName: true } } },
      });

      if (body.stage !== undefined && body.stage !== existing.stage) {
        await addLeadActivity(tx, {
          institutionId: institution.id,
          leadId: id,
          actorUserId: user.id,
          kind: "STAGE_CHANGED",
          note: body.stage === "LOST" ? lostReason : null,
          meta: { from: existing.stage, to: body.stage },
        });
      }
      if (body.nextFollowupAt !== undefined) {
        await addLeadActivity(tx, {
          institutionId: institution.id,
          leadId: id,
          actorUserId: user.id,
          kind: "FOLLOWUP_CHANGED",
          meta: { nextFollowupAt: body.nextFollowupAt },
        });
      }
      if (body.assignedToId !== undefined && body.assignedToId !== existing.assignedToId) {
        await addLeadActivity(tx, {
          institutionId: institution.id,
          leadId: id,
          actorUserId: user.id,
          kind: "OWNER_CHANGED",
          meta: { assignedToId: body.assignedToId },
        });
      }
      if (body.lastNote?.trim() && body.lastNote.trim() !== existing.lastNote) {
        await addLeadActivity(tx, {
          institutionId: institution.id,
          leadId: id,
          actorUserId: user.id,
          kind: "NOTE",
          note: body.lastNote,
        });
      }
      return { lead: updated, duplicates };
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "lead.update",
      targetId: id,
      outcome: "success",
      meta: { changedFields: Object.keys(body) },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to update lead");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_DELETE_FORBIDDEN", "Admissions are available only to owners and admins");
    const { id } = await params;

    const deleted = await withRls(user.id, (tx) =>
      tx.lead.deleteMany({
        where: { id, institutionId: institution.id, convertedToStudentId: null },
      })
    );
    if (deleted.count === 0) {
      throw new ApiError(409, "LEAD_DELETE_BLOCKED", "Converted or missing leads cannot be deleted");
    }

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "lead.delete",
      targetId: id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete lead");
  }
}
