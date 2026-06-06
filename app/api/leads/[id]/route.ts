import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (body.studentName    !== undefined) data.studentName    = (body.studentName as string).trim();
    if (body.guardianName   !== undefined) data.guardianName   = (body.guardianName as string).trim();
    if (body.phone          !== undefined) data.phone          = (body.phone as string).trim();
    if (body.interestedClass !== undefined) data.interestedClass = (body.interestedClass as string)?.trim() || null;
    if (body.source         !== undefined) data.source         = body.source;
    if (body.priority       !== undefined) data.priority       = body.priority;
    if (body.stage          !== undefined) data.stage          = body.stage;
    if (body.lastNote       !== undefined) data.lastNote       = (body.lastNote as string)?.trim() || null;
    if (body.nextFollowupAt !== undefined) {
      data.nextFollowupAt = body.nextFollowupAt ? new Date(body.nextFollowupAt as string) : null;
    }

    const count = await withRls(user.id, (tx) =>
      tx.lead.updateMany({ where: { id, institutionId: institution.id }, data })
    );

    if (count.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;

    await withRls(user.id, (tx) =>
      tx.lead.deleteMany({ where: { id, institutionId: institution.id } })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
