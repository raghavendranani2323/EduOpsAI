import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
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
    const { user, institution } = await requireInstitution();
    const body = await req.json() as {
      studentName:    string;
      guardianName:   string;
      phone:          string;
      interestedClass?: string;
      source:         string;
      priority:       string;
      stage:          string;
      nextFollowupAt?: string;
      lastNote?:      string;
    };

    const { studentName, guardianName, phone, interestedClass, source, priority, stage, nextFollowupAt, lastNote } = body;
    if (!studentName || !guardianName || !phone) {
      return NextResponse.json({ ok: false, error: "studentName, guardianName, phone required" }, { status: 400 });
    }

    const lead = await withRls(user.id, (tx) =>
      tx.lead.create({
        data: {
          institutionId: institution.id,
          studentName:   studentName.trim(),
          guardianName:  guardianName.trim(),
          phone:         phone.trim(),
          interestedClass: interestedClass?.trim() || null,
          source:        source as "WALK_IN" | "PHONE" | "INSTAGRAM" | "WHATSAPP" | "REFERRAL" | "WEBSITE",
          priority:      priority as "HOT" | "WARM" | "COLD",
          stage:         stage as "NEW" | "CONTACTED" | "DEMO_SCHEDULED" | "DEMO_ATTENDED" | "CONVERTED" | "LOST",
          nextFollowupAt: nextFollowupAt ? new Date(nextFollowupAt) : null,
          lastNote:      lastNote?.trim() || null,
        },
      })
    );

    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
