import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";

export async function GET() {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (membership.role === "TEACHER") return NextResponse.json({ ok: false, error: "Not available for teacher accounts" }, { status: 403 });

    const templates = await withRls(user.id, (tx) =>
      tx.messageTemplate.findMany({
        where: { institutionId: institution.id },
        orderBy: { createdAt: "desc" },
      })
    );

    return NextResponse.json({ ok: true, templates });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (membership.role === "TEACHER") return NextResponse.json({ ok: false, error: "Not available for teacher accounts" }, { status: 403 });
    const body = await req.json() as { kind: string; language: string; body: string };

    if (!body.kind || !body.body) {
      return NextResponse.json({ ok: false, error: "kind and body required" }, { status: 400 });
    }

    const template = await withRls(user.id, (tx) =>
      tx.messageTemplate.create({
        data: {
          institutionId: institution.id,
          kind:          body.kind as "FEE_REMINDER" | "ABSENCE" | "EXAM_SCORE" | "BIRTHDAY" | "HOMEWORK" | "CUSTOM",
          language:      body.language || "en",
          body:          body.body.trim(),
        },
      })
    );

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "communications.template.create",
      targetId: template.id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true, template });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e);
    return serverErrorResponse("Failed to create template");
  }
}
