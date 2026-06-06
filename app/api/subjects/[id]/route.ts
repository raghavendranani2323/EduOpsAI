import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
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
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    await withRls(user.id, (tx) =>
      tx.subject.deleteMany({ where: { id, institutionId: institution.id } })
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
