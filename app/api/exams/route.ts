import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertClassAccess, assertRole, authorizedClassIds } from "@/lib/auth/permissions";

export async function GET(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") ?? "";

    const exams = await withRls(user.id, async (tx) => {
      const ids = await authorizedClassIds(tx, user.id, institution.id, membership.role);
      if (classId) {
        await assertClassAccess(tx, { userId: user.id, institutionId: institution.id, role: membership.role, classId });
      }
      return tx.exam.findMany({
        where: {
          institutionId: institution.id,
          ...(classId
            ? { classId }
            : ids !== null
              ? { classId: { in: ids.length ? ids : ["__none__"] } }
              : {}),
        },
        include: { class: { select: { name: true } }, _count: { select: { results: true } } },
        orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
      });
    });

    return NextResponse.json({ ok: true, exams });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load exams");
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "EXAM_CREATE_FORBIDDEN", "Only owners and admins can create exams");
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
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to create exam");
  }
}
