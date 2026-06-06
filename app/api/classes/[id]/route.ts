import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    const body = await req.json() as { name?: string; section?: string; academicYear?: string };

    const cls = await withRls(user.id, (tx) =>
      tx.class.updateMany({
        where: { id, institutionId: institution.id },
        data: {
          ...(body.name        ? { name: body.name.trim() }         : {}),
          ...(body.section !== undefined ? { section: body.section?.trim() || null } : {}),
          ...(body.academicYear ? { academicYear: body.academicYear.trim() } : {}),
        },
      })
    );

    if (cls.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;

    // Unassign students before deleting the class
    await withRls(user.id, async (tx) => {
      await tx.student.updateMany({
        where: { classId: id, institutionId: institution.id },
        data: { classId: null },
      });
      await tx.class.deleteMany({ where: { id, institutionId: institution.id } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
