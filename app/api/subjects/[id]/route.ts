import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "SUBJECT_UPDATE_FORBIDDEN", "Only owners and admins can update subjects");
    const { id } = await params;
    const body = await req.json() as { name?: string; code?: string; classId?: string };
    const data: Record<string, string | null> = {};
    if (body.name    !== undefined) data.name    = body.name.trim();
    if (body.code    !== undefined) data.code    = body.code?.trim() || null;
    if (body.classId !== undefined) data.classId = body.classId || null;
    await withRls(user.id, (tx) =>
      tx.subject.updateMany({ where: { id, institutionId: institution.id }, data })
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to update subject");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "SUBJECT_DELETE_FORBIDDEN", "Only owners and admins can delete subjects");
    const { id } = await params;
    await withRls(user.id, (tx) =>
      tx.subject.deleteMany({ where: { id, institutionId: institution.id } })
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete subject");
  }
}
