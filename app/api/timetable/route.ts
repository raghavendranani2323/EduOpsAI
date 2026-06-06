import { NextRequest, NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: NextRequest) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const slots = await withRls(user.id, async (tx) => {
      return tx.timetableSlot.findMany({
        where: {
          institutionId: institution.id,
          ...(classId ? { classId } : {}),
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    });

    return NextResponse.json({ ok: true, slots });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json();
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, label } = body;

    if (!classId || !dayOfWeek || !startTime || !endTime) {
      return NextResponse.json({ ok: false, error: "classId, dayOfWeek, startTime, endTime required" }, { status: 400 });
    }

    const slot = await withRls(user.id, async (tx) => {
      return tx.timetableSlot.create({
        data: {
          institutionId: institution.id,
          classId,
          subjectId: subjectId || null,
          teacherId: teacherId || null,
          dayOfWeek: Number(dayOfWeek),
          startTime,
          endTime,
          label: label || null,
        },
      });
    });

    return NextResponse.json({ ok: true, slot });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to create slot" }, { status: 500 });
  }
}
