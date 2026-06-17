import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";
import {
  getHomeworkStorageClient,
  HOMEWORK_BUCKET,
  isHomeworkObjectKeyForClass,
  isHomeworkObjectKeyForInstitution,
} from "@/lib/homework/attachments";
import { withRls } from "@/lib/prisma/rls";
import { requireInstitution } from "@/lib/tenant/current";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(5000).nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  subjectId: z.string().min(1).max(191).nullish(),
  attachmentUrl: z.string().max(1024).nullish(),
  attachmentMime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).nullish(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes supplied");

async function canManageHomeworkClass(
  tx: Prisma.TransactionClient,
  institutionId: string,
  userId: string,
  role: string,
  classId: string,
) {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role !== "TEACHER") return false;
  const classIds = await getTeacherClassIds(tx, userId, institutionId, "TEACHER");
  return (classIds ?? []).includes(classId);
}

async function removeStoredAttachment(key: string | null, institutionId: string) {
  if (!key || !isHomeworkObjectKeyForInstitution(key, institutionId)) return true;
  const { error } = await getHomeworkStorageClient().storage.from(HOMEWORK_BUCKET).remove([key]);
  if (error) {
    console.error("[homework] attachment cleanup failed", { reason: error.message });
    return false;
  }
  return true;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let audit: { actorUserId: string; institutionId: string } | null = null;
  try {
    const { user, institution, membership } = await requireInstitution();
    audit = { actorUserId: user.id, institutionId: institution.id };
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_HOMEWORK_UPDATE", parsed.error.issues[0]?.message ?? "Invalid homework update");
    }

    const result = await withRls(user.id, async (tx) => {
      const existing = await tx.homework.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;

      const allowed = await canManageHomeworkClass(tx, institution.id, user.id, membership.role, existing.classId);
      if (!allowed) {
        throw new ApiError(403, "HOMEWORK_FORBIDDEN", "You cannot update homework for this class");
      }

      if (parsed.data.subjectId) {
        const subject = await tx.subject.findFirst({
          where: {
            id: parsed.data.subjectId,
            institutionId: institution.id,
            OR: [{ classId: null }, { classId: existing.classId }],
          },
          select: { id: true },
        });
        if (!subject) throw new ApiError(400, "INVALID_HOMEWORK_SUBJECT", "Subject is not available for this class");
      }

      const nextAttachmentUrl = parsed.data.attachmentUrl === undefined
        ? existing.attachmentUrl
        : parsed.data.attachmentUrl;
      const nextAttachmentMime = parsed.data.attachmentUrl === null
        ? null
        : parsed.data.attachmentMime === undefined
          ? existing.attachmentMime
          : parsed.data.attachmentMime;
      if (nextAttachmentUrl && !isHomeworkObjectKeyForClass(nextAttachmentUrl, institution.id, existing.classId)) {
        throw new ApiError(400, "INVALID_HOMEWORK_ATTACHMENT", "Invalid homework attachment");
      }
      if (!!nextAttachmentUrl !== !!nextAttachmentMime) {
        throw new ApiError(400, "INVALID_HOMEWORK_ATTACHMENT", "Attachment file and type must be provided together");
      }

      const homework = await tx.homework.update({
        where: { id },
        data: {
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
          ...(parsed.data.dueDate !== undefined ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null } : {}),
          ...(parsed.data.subjectId !== undefined ? { subjectId: parsed.data.subjectId || null } : {}),
          ...(parsed.data.attachmentUrl !== undefined ? { attachmentUrl: nextAttachmentUrl } : {}),
          ...(parsed.data.attachmentUrl !== undefined || parsed.data.attachmentMime !== undefined
            ? { attachmentMime: nextAttachmentMime }
            : {}),
        },
      });
      return {
        homework,
        previousAttachment: existing.attachmentUrl,
        attachmentChanged: existing.attachmentUrl !== nextAttachmentUrl,
      };
    });

    if (!result) throw new ApiError(404, "HOMEWORK_NOT_FOUND", "Homework not found");
    const storageCleaned = result.attachmentChanged
      ? await removeStoredAttachment(result.previousAttachment, institution.id)
      : true;

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: result.attachmentChanged ? "homework.attachment.replace" : "homework.update",
      targetId: id,
      outcome: "success",
      meta: { storageCleaned },
    });
    return NextResponse.json({ ok: true, homework: result.homework });
  } catch (err) {
    if (err instanceof ApiError) {
      if (audit) {
        await writeAuditEvent({
          actorUserId: audit.actorUserId,
          institutionId: audit.institutionId,
          action: "homework.update.denied",
          targetId: id,
          outcome: err.status === 403 ? "denied" : "failure",
          meta: { code: err.code },
        });
      }
      return errorResponse(err);
    }
    console.error("[homework] update failed", err instanceof Error ? err.message : err);
    return serverErrorResponse("Failed to update homework");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let audit: { actorUserId: string; institutionId: string } | null = null;
  try {
    const { user, institution, membership } = await requireInstitution();
    audit = { actorUserId: user.id, institutionId: institution.id };

    const deleted = await withRls(user.id, async (tx) => {
      const existing = await tx.homework.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;
      const allowed = await canManageHomeworkClass(tx, institution.id, user.id, membership.role, existing.classId);
      if (!allowed) {
        throw new ApiError(403, "HOMEWORK_FORBIDDEN", "You cannot delete homework for this class");
      }
      await tx.homework.delete({ where: { id } });
      return { attachmentUrl: existing.attachmentUrl };
    });

    if (!deleted) throw new ApiError(404, "HOMEWORK_NOT_FOUND", "Homework not found");
    const storageCleaned = await removeStoredAttachment(deleted.attachmentUrl, institution.id);
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "homework.delete",
      targetId: id,
      outcome: "success",
      meta: { storageCleaned, hadAttachment: !!deleted.attachmentUrl },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      if (audit) {
        await writeAuditEvent({
          actorUserId: audit.actorUserId,
          institutionId: audit.institutionId,
          action: "homework.delete.denied",
          targetId: id,
          outcome: err.status === 403 ? "denied" : "failure",
          meta: { code: err.code },
        });
      }
      return errorResponse(err);
    }
    console.error("[homework] delete failed", err instanceof Error ? err.message : err);
    return serverErrorResponse("Failed to delete homework");
  }
}
