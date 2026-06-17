import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";
import { isHomeworkObjectKeyForClass } from "@/lib/homework/attachments";
import { assertRole } from "@/lib/auth/permissions";

const homeworkSchema = z.object({
  classId: z.string().min(1).max(191),
  subjectId: z.string().min(1).max(191).nullish(),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5000).nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  attachmentUrl: z.string().max(1024).nullish(),
  attachmentMime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).nullish(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN", "TEACHER"], "HOMEWORK_ACCESS_FORBIDDEN", "Homework is not available for this role");
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const homework = await withRls(user.id, async (tx) => {
      const teacherIds = await getTeacherClassIds(tx, user.id, institution.id, membership.role);
      return tx.homework.findMany({
        where: {
          institutionId: institution.id,
          ...(classId ? { classId } : {}),
          ...(teacherIds !== null ? { classId: { in: teacherIds.length ? teacherIds : ["__none__"] } } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    });

    return NextResponse.json({ ok: true, homework });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const parsed = homeworkSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_HOMEWORK", parsed.error.issues[0]?.message ?? "Invalid homework");
    }
    const { classId, subjectId, title, description, dueDate, attachmentUrl, attachmentMime } = parsed.data;

    const ok = await withRls(user.id, async (tx) => {
      const cls = await tx.class.findFirst({ where: { id: classId, institutionId: institution.id }, select: { id: true } });
      if (!cls) return false;
      if (subjectId) {
        const subject = await tx.subject.findFirst({
          where: {
            id: subjectId,
            institutionId: institution.id,
            OR: [{ classId: null }, { classId }],
          },
          select: { id: true },
        });
        if (!subject) throw new ApiError(400, "INVALID_HOMEWORK_SUBJECT", "Subject is not available for this class");
      }
      if (membership.role === "OWNER" || membership.role === "ADMIN") return true;
      if (membership.role === "TEACHER") {
        const ids = await getTeacherClassIds(tx, user.id, institution.id, "TEACHER");
        return (ids ?? []).includes(classId);
      }
      return false;
    });
    if (!ok) {
      throw new ApiError(403, "HOMEWORK_FORBIDDEN", "You cannot post homework for this class");
    }

    if (attachmentUrl && !isHomeworkObjectKeyForClass(attachmentUrl, institution.id, classId)) {
      throw new ApiError(400, "INVALID_HOMEWORK_ATTACHMENT", "Invalid homework attachment");
    }
    if (!!attachmentUrl !== !!attachmentMime) {
      throw new ApiError(400, "INVALID_HOMEWORK_ATTACHMENT", "Attachment file and type must be provided together");
    }

    const hw = await withRls(user.id, async (tx) => {
      return tx.homework.create({
        data: {
          institutionId: institution.id,
          classId,
          subjectId: subjectId || null,
          teacherId: user.id,
          title,
          description: description || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          attachmentUrl: attachmentUrl || null,
          attachmentMime: attachmentMime || null,
        },
      });
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "homework.create",
      targetId: hw.id,
      outcome: "success",
      meta: { classId, hasAttachment: !!attachmentUrl },
    });

    return NextResponse.json({ ok: true, homework: hw });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e);
    console.error("[homework] create failed", e instanceof Error ? e.message : e);
    return serverErrorResponse("Failed to post homework");
  }
}
