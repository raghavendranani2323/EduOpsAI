import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET() {
  try {
    const { user, institution } = await requireInstitution();
    const classes = await withRls(user.id, (tx) =>
      tx.class.findMany({
        where: { institutionId: institution.id },
        include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
        orderBy: { name: "asc" },
      })
    );
    return NextResponse.json({ ok: true, classes });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as { name?: string; section?: string; academicYear?: string };

    if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    if (!body.academicYear?.trim()) return NextResponse.json({ ok: false, error: "Academic year is required" }, { status: 400 });

    const cls = await withRls(user.id, (tx) =>
      tx.class.create({
        data: {
          institutionId: institution.id,
          name: body.name!.trim(),
          section: body.section?.trim() || null,
          academicYear: body.academicYear!.trim(),
        },
      })
    );
    return NextResponse.json({ ok: true, class: cls }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
