import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function PATCH(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json() as {
      name?: string;
      city?: string;
      state?: string;
      board?: string;
      affiliationNo?: string;
    };

    const data: Record<string, string | null> = {};
    if (body.name         !== undefined) data.name         = body.name.trim();
    if (body.city         !== undefined) data.city         = body.city.trim();
    if (body.state        !== undefined) data.state        = body.state.trim();
    if (body.board        !== undefined) data.board        = body.board?.trim() || null;
    if (body.affiliationNo !== undefined) data.affiliationNo = body.affiliationNo?.trim() || null;

    await withRls(user.id, (tx) =>
      tx.institution.update({ where: { id: institution.id }, data })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
