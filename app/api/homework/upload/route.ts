import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";
import {
  buildHomeworkObjectKey,
  createHomeworkSignedUrl,
  getHomeworkStorageClient,
  HOMEWORK_BUCKET,
  validateHomeworkFile,
} from "@/lib/homework/attachments";

const classIdSchema = z.string().min(1).max(191);

export async function POST(req: Request) {
  let audit: { actorUserId: string; institutionId: string; classId?: string | null } | null = null;
  try {
    const { user, institution, membership } = await requireInstitution();

    const form = await req.formData();
    const parsedClassId = classIdSchema.safeParse(form.get("classId"));
    const classId = parsedClassId.success ? parsedClassId.data : "";
    audit = { actorUserId: user.id, institutionId: institution.id, classId };
    if (!parsedClassId.success) {
      throw new ApiError(400, "CLASS_REQUIRED", "Pick a class before uploading homework");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "FILE_REQUIRED", "Choose a file to upload");
    }

    const allowed = await validateHomeworkFile(file);
    const canUpload = await withRls(user.id, async (tx) => {
      const cls = await tx.class.findFirst({ where: { id: classId, institutionId: institution.id }, select: { id: true } });
      if (!cls) return false;
      if (membership.role === "OWNER" || membership.role === "ADMIN") return true;
      if (membership.role !== "TEACHER") return false;
      const teacherClassIds = await getTeacherClassIds(tx, user.id, institution.id, "TEACHER");
      return !!teacherClassIds?.includes(classId);
    });
    if (!canUpload) {
      throw new ApiError(403, "HOMEWORK_UPLOAD_FORBIDDEN", "You cannot upload homework for this class");
    }

    const key = buildHomeworkObjectKey(institution.id, classId, user.id, allowed.ext);
    const admin = getHomeworkStorageClient();
    const { error } = await admin.storage.from(HOMEWORK_BUCKET).upload(key, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error("[homework/upload] storage failure", error.message);
      throw new ApiError(500, "STORAGE_UPLOAD_FAILED", "Could not upload homework file");
    }
    const signedUrl = await createHomeworkSignedUrl(key);
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "homework.upload",
      targetId: classId,
      outcome: "success",
      meta: { mime: file.type, size: file.size },
    });

    return NextResponse.json({ ok: true, objectKey: key, signedUrl, mime: file.type });
  } catch (err) {
    if (err instanceof ApiError) {
      if (audit) {
        await writeAuditEvent({
          actorUserId: audit.actorUserId,
          institutionId: audit.institutionId,
          action: "homework.upload",
          targetId: audit.classId ?? null,
          outcome: err.status === 403 ? "denied" : "failure",
          meta: { code: err.code },
        });
      }
      return errorResponse(err);
    }
    console.error("[homework/upload] failed", err instanceof Error ? err.message : err);
    return serverErrorResponse("Failed to upload homework file");
  }
}
