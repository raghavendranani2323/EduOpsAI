import { NextRequest, NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: NextRequest) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const homework = await withRls(user.id, async (tx) => {
      return tx.homework.findMany({
        where: {
          institutionId: institution.id,
          ...(classId ? { classId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    });

    return NextResponse.json({ ok: true, homework });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json();
    const { classId, subjectId, title, description, dueDate } = body;

    if (!classId || !title) {
      return NextResponse.json({ ok: false, error: "classId and title required" }, { status: 400 });
    }

    const hw = await withRls(user.id, async (tx) => {
      return tx.homework.create({
        data: {
          institutionId: institution.id,
          classId,
          subjectId: subjectId || null,
          teacherId: user.id,
          title,
          description: description || null,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });
    });

    return NextResponse.json({ ok: true, homework: hw });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to create homework" }, { status: 500 });
  }
}
