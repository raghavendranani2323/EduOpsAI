import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") ?? "";

    const subjects = await withRls(user.id, (tx) =>
      tx.subject.findMany({
        where: { institutionId: institution.id, ...(classId ? { classId } : {}) },
        orderBy: { name: "asc" },
      })
    );
    return NextResponse.json({ ok: true, subjects });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as { name: string; code?: string; classId?: string };
    if (!body.name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const subject = await withRls(user.id, (tx) =>
      tx.subject.create({
        data: {
          institutionId: institution.id,
          name:    body.name.trim(),
          code:    body.code?.trim() || null,
          classId: body.classId || null,
        },
      })
    );
    return NextResponse.json({ ok: true, subject });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
