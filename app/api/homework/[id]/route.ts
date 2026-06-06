import { NextRequest, NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution } = await requireInstitution();
    const body = await req.json();

    const hw = await withRls(user.id, async (tx) => {
      const existing = await tx.homework.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;
      return tx.homework.update({
        where: { id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description || null } : {}),
          ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
          ...(body.subjectId !== undefined ? { subjectId: body.subjectId || null } : {}),
        },
      });
    });

    if (!hw) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, homework: hw });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution } = await requireInstitution();

    await withRls(user.id, async (tx) => {
      const existing = await tx.homework.findFirst({ where: { id, institutionId: institution.id } });
      if (existing) await tx.homework.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to delete" }, { status: 500 });
  }
}
