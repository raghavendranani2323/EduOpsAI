import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "EXAM_UPDATE_FORBIDDEN", "Only owners and admins can update exams");
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (body.name         !== undefined) data.name         = (body.name as string).trim();
    if (body.classId      !== undefined) data.classId      = body.classId || null;
    if (body.examDate     !== undefined) data.examDate     = body.examDate ? new Date(body.examDate as string) : null;
    if (body.totalMarks   !== undefined) data.totalMarks   = Number(body.totalMarks);
    if (body.passingMarks !== undefined) data.passingMarks = Number(body.passingMarks);
    if (body.academicYear !== undefined) data.academicYear = (body.academicYear as string)?.trim() || null;

    const count = await withRls(user.id, (tx) =>
      tx.exam.updateMany({ where: { id, institutionId: institution.id }, data })
    );
    if (count.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to update exam");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "EXAM_DELETE_FORBIDDEN", "Only owners and admins can delete exams");
    const { id } = await params;
    await withRls(user.id, (tx) =>
      tx.exam.deleteMany({ where: { id, institutionId: institution.id } })
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to delete exam");
  }
}
