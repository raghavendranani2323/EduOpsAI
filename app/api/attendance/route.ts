import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date    = searchParams.get("date");

    if (!classId || !date) {
      return NextResponse.json({ ok: false, error: "classId and date are required" }, { status: 400 });
    }

    const session = await withRls(user.id, (tx) =>
      tx.attendanceSession.findFirst({
        where: {
          classId,
          institutionId: institution.id,
          sessionDate: new Date(date),
        },
        include: { records: true },
      })
    );

    return NextResponse.json({ ok: true, session });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as {
      classId:      string;
      date:         string;
      sessionLabel?: string;
      records:      { studentId: string; status: string; note?: string }[];
    };

    const { classId, date, records } = body;
    const sessionLabel = body.sessionLabel ?? "morning";

    if (!classId || !date || !Array.isArray(records)) {
      return NextResponse.json({ ok: false, error: "classId, date, and records are required" }, { status: 400 });
    }

    const validStatuses = new Set(["PRESENT", "ABSENT", "LATE", "HALF_DAY"]);
    const cleaned = records.filter(r => r.studentId && validStatuses.has(r.status));

    const session = await withRls(user.id, async (tx) => {
      const session = await tx.attendanceSession.upsert({
        where: {
          classId_sessionDate_sessionLabel: {
            classId,
            sessionDate: new Date(date),
            sessionLabel,
          },
        },
        create: {
          institutionId: institution.id,
          classId,
          sessionDate: new Date(date),
          sessionLabel,
          markedBy: user.id,
        },
        update: {
          markedAt: new Date(),
        },
      });

      // Replace all records for this session
      await tx.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
      if (cleaned.length > 0) {
        await tx.attendanceRecord.createMany({
          data: cleaned.map(r => ({
            sessionId: session.id,
            studentId: r.studentId,
            status:    r.status as "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY",
            note:      r.note ?? null,
          })),
        });
      }

      return session;
    });

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Failed to save attendance" }, { status: 500 });
  }
}
