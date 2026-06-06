import { NextRequest, NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution } = await requireInstitution();
    const body = await req.json();
    const { subjectId, teacherId, dayOfWeek, startTime, endTime, label } = body;

    const slot = await withRls(user.id, async (tx) => {
      const existing = await tx.timetableSlot.findFirst({ where: { id, institutionId: institution.id } });
      if (!existing) return null;
      return tx.timetableSlot.update({
        where: { id },
        data: {
          ...(subjectId !== undefined ? { subjectId: subjectId || null } : {}),
          ...(teacherId !== undefined ? { teacherId: teacherId || null } : {}),
          ...(dayOfWeek !== undefined ? { dayOfWeek: Number(dayOfWeek) } : {}),
          ...(startTime !== undefined ? { startTime } : {}),
          ...(endTime !== undefined ? { endTime } : {}),
          ...(label !== undefined ? { label: label || null } : {}),
        },
      });
    });

    if (!slot) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, slot });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to update slot" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, institution } = await requireInstitution();

    await withRls(user.id, async (tx) => {
      const existing = await tx.timetableSlot.findFirst({ where: { id, institutionId: institution.id } });
      if (existing) await tx.timetableSlot.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to delete slot" }, { status: 500 });
  }
}
