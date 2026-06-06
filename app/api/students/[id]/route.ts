import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;

    const student = await withRls(user.id, (tx) =>
      tx.student.findFirst({
        where: { id, institutionId: institution.id },
        include: {
          class: { select: { id: true, name: true } },
          studentTags: { include: { tag: true } },
          guardians: { include: { guardian: true } },
          invoices: {
            orderBy: { dueDate: "desc" },
            take: 10,
            select: { id: true, status: true, amountDue: true, amountPaid: true, dueDate: true, periodStart: true, periodEnd: true },
          },
        },
      })
    );

    if (!student) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, student });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;
    const body = await req.json() as {
      fullName?: string;
      admissionNo?: string;
      gender?: string;
      dob?: string;
      classId?: string | null;
      status?: string;
      tagIds?: string[];
    };

    await withRls(user.id, async (tx) => {
      await tx.student.updateMany({
        where: { id, institutionId: institution.id },
        data: {
          ...(body.fullName   !== undefined ? { fullName: body.fullName.trim() }    : {}),
          ...(body.admissionNo !== undefined ? { admissionNo: body.admissionNo?.trim() || null } : {}),
          ...(body.gender     !== undefined ? { gender: body.gender as "MALE" | "FEMALE" | "OTHER" | null } : {}),
          ...(body.dob        !== undefined ? { dob: body.dob ? new Date(body.dob) : null } : {}),
          ...(body.classId    !== undefined ? { classId: body.classId }             : {}),
          ...(body.status     !== undefined ? { status: body.status as "ACTIVE" | "ARCHIVED" } : {}),
        },
      });

      if (body.tagIds !== undefined) {
        await tx.studentTag.deleteMany({ where: { studentId: id } });
        if (body.tagIds.length > 0) {
          await tx.studentTag.createMany({
            data: body.tagIds.map(tagId => ({ studentId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await params;

    await withRls(user.id, (tx) =>
      tx.student.deleteMany({ where: { id, institutionId: institution.id } })
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
