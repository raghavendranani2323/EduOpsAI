import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") ?? "";

    const exams = await withRls(user.id, (tx) =>
      tx.exam.findMany({
        where: {
          institutionId: institution.id,
          ...(classId ? { classId } : {}),
        },
        include: { class: { select: { name: true } }, _count: { select: { results: true } } },
        orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
      })
    );

    return NextResponse.json({ ok: true, exams });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as {
      name: string; classId?: string; examDate?: string;
      totalMarks?: number; passingMarks?: number; academicYear?: string;
    };

    if (!body.name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const exam = await withRls(user.id, (tx) =>
      tx.exam.create({
        data: {
          institutionId: institution.id,
          name:          body.name.trim(),
          classId:       body.classId || null,
          examDate:      body.examDate ? new Date(body.examDate) : null,
          totalMarks:    body.totalMarks ?? 100,
          passingMarks:  body.passingMarks ?? 35,
          academicYear:  body.academicYear?.trim() || null,
        },
      })
    );

    return NextResponse.json({ ok: true, exam });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
