import { NextRequest, NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution } = await requireInstitution();
    const body = await req.json();

    const notice = await withRls(user.id, async (tx) => {
      const existing = await tx.notice.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;
      return tx.notice.update({
        where: { id },
        data: {
          ...(body.title    !== undefined ? { title: body.title } : {}),
          ...(body.body     !== undefined ? { body: body.body } : {}),
          ...(body.audience !== undefined ? { audience: body.audience } : {}),
          ...(body.classId  !== undefined ? { classId: body.classId || null } : {}),
          ...(body.pinned   !== undefined ? { pinned: body.pinned } : {}),
          ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
        },
      });
    });

    if (!notice) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, notice });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution } = await requireInstitution();

    await withRls(user.id, async (tx) => {
      const existing = await tx.notice.findFirst({ where: { id, institutionId: institution.id } });
      if (existing) await tx.notice.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to delete" }, { status: 500 });
  }
}
