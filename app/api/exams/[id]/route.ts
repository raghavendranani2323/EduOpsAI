import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
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
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    await withRls(user.id, (tx) =>
      tx.exam.deleteMany({ where: { id, institutionId: institution.id } })
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
