import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

const attendanceSchema = z.object({
  classId:      z.string().min(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  sessionLabel: z.string().max(20).optional(),
  records: z.array(z.object({
    studentId: z.string().min(1),
    status:    z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY"]),
    note:      z.string().max(500).optional(),
  })).max(500),
});

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
    const parsed = attendanceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { classId, date, records } = parsed.data;
    const sessionLabel = parsed.data.sessionLabel ?? "morning";
    const cleaned = records;

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
            status:    r.status,
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
