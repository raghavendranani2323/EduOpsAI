import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import { withRls } from "@/lib/prisma/rls";
import { addLeadActivity } from "@/lib/admissions/crm";
import { writeAuditEvent } from "@/lib/audit/server";

const activitySchema = z.object({
  kind: z.enum(["NOTE", "CALL", "WHATSAPP"]),
  note: z.string().trim().max(2000).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_ACTIVITY_FORBIDDEN", "Admissions are available only to owners and admins");
    const { id } = await params;
    const activities = await withRls(user.id, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, institutionId: institution.id }, select: { id: true } });
      if (!lead) throw new ApiError(404, "LEAD_NOT_FOUND", "Lead not found");
      return tx.leadActivity.findMany({
        where: { institutionId: institution.id, leadId: id },
        include: { actor: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });
    return NextResponse.json({ ok: true, activities });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load lead activity");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_ACTIVITY_FORBIDDEN", "Admissions are available only to owners and admins");
    const { id } = await params;
    const parsed = activitySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "INVALID_LEAD_ACTIVITY", "Invalid activity");

    const activity = await withRls(user.id, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, institutionId: institution.id }, select: { id: true } });
      if (!lead) throw new ApiError(404, "LEAD_NOT_FOUND", "Lead not found");
      return addLeadActivity(tx, {
        institutionId: institution.id,
        leadId: id,
        actorUserId: user.id,
        kind: parsed.data.kind,
        note: parsed.data.note,
      });
    });
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: `lead.activity.${parsed.data.kind.toLowerCase()}`,
      targetId: id,
      outcome: "success",
    });
    return NextResponse.json({ ok: true, activity }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to record lead activity");
  }
}
