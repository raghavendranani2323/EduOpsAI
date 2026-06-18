import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (membership.role === "TEACHER") return NextResponse.json({ ok: false, error: "Not available for teacher accounts" }, { status: 403 });
    const { id } = await params;
    const body = await req.json() as { kind?: string; language?: string; body?: string };

    const data: Record<string, string> = {};
    if (body.kind)     data.kind     = body.kind;
    if (body.language) data.language = body.language;
    if (body.body)     data.body     = body.body.trim();

    const count = await withRls(user.id, (tx) =>
      tx.messageTemplate.updateMany({ where: { id, institutionId: institution.id }, data })
    );
    if (count.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    await writeAuditEvent({ actorUserId: user.id, institutionId: institution.id, action: "communications.template.update", targetId: id, outcome: "success" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e);
    return serverErrorResponse("Failed to update template");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (membership.role === "TEACHER") return NextResponse.json({ ok: false, error: "Not available for teacher accounts" }, { status: 403 });
    const { id } = await params;
    await withRls(user.id, (tx) =>
      tx.messageTemplate.deleteMany({ where: { id, institutionId: institution.id } })
    );
    await writeAuditEvent({ actorUserId: user.id, institutionId: institution.id, action: "communications.template.delete", targetId: id, outcome: "success" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e);
    return serverErrorResponse("Failed to delete template");
  }
}
