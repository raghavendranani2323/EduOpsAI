import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

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
});

export async function GET(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (membership.role === "TEACHER") return NextResponse.json({ ok: false, error: "Not available for teacher accounts" }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const stage    = searchParams.get("stage") ?? "ALL";
    const priority = searchParams.get("priority") ?? "ALL";
    const q        = searchParams.get("q")?.trim() ?? "";

    const where: Record<string, unknown> = { institutionId: institution.id };
    if (stage    !== "ALL") where.stage    = stage;
    if (priority !== "ALL") where.priority = priority;
    if (q) where.studentName = { contains: q, mode: "insensitive" };

    const leads = await withRls(user.id, (tx) =>
      tx.lead.findMany({
        where,
        orderBy: [{ nextFollowupAt: "asc" }, { createdAt: "desc" }],
      })
    );

    return NextResponse.json({ ok: true, leads });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (membership.role === "TEACHER") return NextResponse.json({ ok: false, error: "Not available for teacher accounts" }, { status: 403 });
    const parsed = leadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const d = parsed.data;

    const lead = await withRls(user.id, (tx) =>
      tx.lead.create({
        data: {
          institutionId: institution.id,
          studentName:   d.studentName.trim(),
          guardianName:  d.guardianName.trim(),
          phone:         d.phone.trim(),
          interestedClass: d.interestedClass?.trim() || null,
          source:        d.source,
          priority:      d.priority,
          stage:         d.stage,
          nextFollowupAt: d.nextFollowupAt ? new Date(d.nextFollowupAt) : null,
          lastNote:      d.lastNote?.trim() || null,
        },
      })
    );

    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Failed to create lead" }, { status: 500 });
  }
}
