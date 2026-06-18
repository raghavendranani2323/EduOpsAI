import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertClassAccess, assertRole, authorizedClassIds } from "@/lib/auth/permissions";

export async function GET(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") ?? "";

    const subjects = await withRls(user.id, async (tx) => {
      const ids = await authorizedClassIds(tx, user.id, institution.id, membership.role);
      if (classId) {
        await assertClassAccess(tx, { userId: user.id, institutionId: institution.id, role: membership.role, classId });
      }
      return tx.subject.findMany({
        where: {
          institutionId: institution.id,
          ...(classId
            ? { classId }
            : ids !== null
              ? { OR: [{ classId: null }, { classId: { in: ids.length ? ids : ["__none__"] } }] }
              : {}),
        },
        orderBy: { name: "asc" },
      });
    });
    return NextResponse.json({ ok: true, subjects });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load subjects");
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "SUBJECT_CREATE_FORBIDDEN", "Only owners and admins can create subjects");
    const body = await req.json() as { name: string; code?: string; classId?: string };
    if (!body.name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const subject = await withRls(user.id, (tx) =>
      tx.subject.create({
        data: {
          institutionId: institution.id,
          name:    body.name.trim(),
          code:    body.code?.trim() || null,
          classId: body.classId || null,
        },
      })
    );
    return NextResponse.json({ ok: true, subject });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to create subject");
  }
}
