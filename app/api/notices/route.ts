import { NextRequest, NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertClassAccess, assertRole, authorizedClassIds } from "@/lib/auth/permissions";
import { writeAuditEvent } from "@/lib/audit/server";

export async function GET(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireApiInstitution();

    const notices = await withRls(user.id, async (tx) => {
      const ids = await authorizedClassIds(tx, user.id, institution.id, membership.role);
      return tx.notice.findMany({
        where: {
          institutionId: institution.id,
          ...(ids !== null
            ? {
                OR: [
                  { audience: "ALL" },
                  { audience: "TEACHERS" },
                  { audience: "CLASS", classId: { in: ids.length ? ids : ["__none__"] } },
                ],
              }
            : {}),
        },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: 50,
      });
    });

    return NextResponse.json({ ok: true, notices });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load notices");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const body = await req.json();
    const { title, body: noticeBody, audience, classId, pinned, expiresAt } = body;

    if (!title || !noticeBody) {
      return NextResponse.json({ ok: false, error: "title and body required" }, { status: 400 });
    }

    const notice = await withRls(user.id, async (tx) => {
      if (membership.role === "TEACHER") {
        if (audience !== "CLASS" || !classId) {
          throw new ApiError(403, "NOTICE_CREATE_FORBIDDEN", "Teachers can publish notices only to assigned classes");
        }
        await assertClassAccess(tx, {
          userId: user.id,
          institutionId: institution.id,
          role: membership.role,
          classId,
        });
      } else {
        assertRole(membership.role, ["OWNER", "ADMIN"], "NOTICE_CREATE_FORBIDDEN", "You cannot publish notices");
        if (classId) {
          await assertClassAccess(tx, {
            userId: user.id,
            institutionId: institution.id,
            role: membership.role,
            classId,
          });
        }
      }
      return tx.notice.create({
        data: {
          institutionId: institution.id,
          authorId:      user.id,
          title,
          body:          noticeBody,
          audience:      audience ?? "ALL",
          classId:       classId || null,
          pinned:        pinned ?? false,
          expiresAt:     expiresAt ? new Date(expiresAt) : null,
        },
      });
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "notice.create",
      targetId: notice.id,
      outcome: "success",
      meta: { audience: notice.audience, classId: notice.classId },
    });
    return NextResponse.json({ ok: true, notice });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to create notice");
  }
}
