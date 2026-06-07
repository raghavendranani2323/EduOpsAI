import { NextRequest, NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";

export async function GET(req: NextRequest) {
  try {
    const { user, institution, membership } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    const homework = await withRls(user.id, async (tx) => {
      const teacherIds = await getTeacherClassIds(tx, user.id, institution.id, membership.role);
      return tx.homework.findMany({
        where: {
          institutionId: institution.id,
          ...(classId ? { classId } : {}),
          ...(teacherIds !== null ? { classId: { in: teacherIds.length ? teacherIds : ["__none__"] } } : {}),
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
    const { user, institution, membership } = await requireInstitution();
    const body = await req.json();
    const { classId, subjectId, title, description, dueDate, attachmentUrl, attachmentMime } = body;

    if (!classId || !title) {
      return NextResponse.json({ ok: false, error: "classId and title required" }, { status: 400 });
    }

    if (membership.role === "TEACHER") {
      const ok = await withRls(user.id, async (tx) => {
        const ids = await getTeacherClassIds(tx, user.id, institution.id, "TEACHER");
        return (ids ?? []).includes(classId);
      });
      if (!ok) {
        return NextResponse.json({ ok: false, error: "You don't teach this class" }, { status: 403 });
      }
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
          attachmentUrl: attachmentUrl || null,
          attachmentMime: attachmentMime || null,
        },
      });
    });

    return NextResponse.json({ ok: true, homework: hw });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
