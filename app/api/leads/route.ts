import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import {
  addLeadActivity,
  assertLeadOwner,
  findLeadDuplicateSignals,
} from "@/lib/admissions/crm";
import { writeAuditEvent } from "@/lib/audit/server";

const leadSchema = z.object({
  studentName:     z.string().min(1).max(200),
  guardianName:    z.string().min(1).max(200),
  phone:           z.string().min(10).max(15),
  interestedClass: z.string().max(100).optional(),
  source:   z.enum(["WALK_IN", "PHONE", "INSTAGRAM", "WHATSAPP", "REFERRAL", "WEBSITE"]),
  priority: z.enum(["HOT", "WARM", "COLD"]),
  stage:    z.enum(["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_ATTENDED", "CONVERTED", "LOST"]),
  nextFollowupAt: z.string().nullable().optional(),
  lastNote:       z.string().max(2000).nullable().optional(),
  assignedToId:   z.string().nullable().optional(),
  lostReason:     z.string().max(500).nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_ACCESS_FORBIDDEN", "Admissions are available only to owners and admins");
    const { searchParams } = new URL(req.url);
    const stage    = searchParams.get("stage") ?? "ALL";
    const priority = searchParams.get("priority") ?? "ALL";
    const q        = searchParams.get("q")?.trim() ?? "";
    const due      = searchParams.get("due") ?? "ALL";
    const ownerId  = searchParams.get("ownerId") ?? "";

    const where: Record<string, unknown> = { institutionId: institution.id };
    if (stage    !== "ALL") where.stage    = stage;
    if (priority !== "ALL") where.priority = priority;
    if (ownerId) where.assignedToId = ownerId;
    if (due === "OVERDUE") {
      where.nextFollowupAt = { lt: new Date() };
      where.stage = { notIn: ["CONVERTED", "LOST"] };
    }
    if (q) {
      where.OR = [
        { studentName: { contains: q, mode: "insensitive" } },
        { guardianName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }

    const leads = await withRls(user.id, (tx) =>
      tx.lead.findMany({
        where,
        include: { assignedTo: { select: { id: true, fullName: true } } },
        orderBy: [{ nextFollowupAt: "asc" }, { createdAt: "desc" }],
      })
    );

    return NextResponse.json({ ok: true, leads });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load leads");
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "LEAD_CREATE_FORBIDDEN", "Admissions are available only to owners and admins");
    const parsed = leadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const d = parsed.data;
    if (d.stage === "LOST" && !d.lostReason?.trim()) {
      throw new ApiError(400, "LOST_REASON_REQUIRED", "Add a reason before marking this lead lost");
    }

    const result = await withRls(user.id, async (tx) => {
      await assertLeadOwner(tx, institution.id, d.assignedToId);
      const duplicates = await findLeadDuplicateSignals(tx, institution.id, {
        phone: d.phone,
        studentName: d.studentName,
      });
      const lead = await tx.lead.create({
        data: {
          institutionId: institution.id,
          studentName:   d.studentName.trim(),
          guardianName:  d.guardianName.trim(),
          phone:         duplicates.phone,
          interestedClass: d.interestedClass?.trim() || null,
          source:        d.source,
          priority:      d.priority,
          stage:         d.stage,
          nextFollowupAt: d.nextFollowupAt ? new Date(d.nextFollowupAt) : null,
          lastNote:      d.lastNote?.trim() || null,
          assignedToId:  d.assignedToId || null,
          lostReason:    d.lostReason?.trim() || null,
        },
        include: { assignedTo: { select: { id: true, fullName: true } } },
      });
      await addLeadActivity(tx, {
        institutionId: institution.id,
        leadId: lead.id,
        actorUserId: user.id,
        kind: "CREATED",
        note: d.lastNote,
        meta: { source: d.source, duplicateLeadCount: duplicates.leadMatches.length },
      });
      return { lead, duplicates };
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "lead.create",
      targetId: result.lead.id,
      outcome: "success",
      meta: { duplicateLeadCount: result.duplicates.leadMatches.length },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to create lead");
  }
}
