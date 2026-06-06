import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const q       = searchParams.get("q")?.trim() ?? "";
    const classId = searchParams.get("classId") ?? "";
    const status  = (searchParams.get("status") ?? "ACTIVE") as "ACTIVE" | "ARCHIVED";
    const cursor  = searchParams.get("cursor") ?? "";

    const where = {
      institutionId: institution.id,
      ...(status !== ("ALL" as string) ? { status } : {}),
      ...(classId ? { classId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { admissionNo: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const rows = await withRls(user.id, (tx) =>
      tx.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          studentTags: { include: { tag: true } },
          guardians: {
            where: { isPrimary: true },
            include: { guardian: { select: { fullName: true, phone: true } } },
            take: 1,
          },
        },
        orderBy: { fullName: "asc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    );

    const hasMore    = rows.length > PAGE_SIZE;
    const page       = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ ok: true, students: page, nextCursor });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as {
      fullName: string;
      admissionNo?: string;
      gender?: string;
      dob?: string;
      classId?: string;
      guardian?: { fullName: string; phone: string; relation?: string };
      tagIds?: string[];
    };

    if (!body.fullName?.trim()) {
      return NextResponse.json({ ok: false, error: "Full name is required" }, { status: 400 });
    }

    const student = await withRls(user.id, async (tx) => {
      const s = await tx.student.create({
        data: {
          institutionId: institution.id,
          fullName: body.fullName.trim(),
          admissionNo: body.admissionNo?.trim() || null,
          gender: (body.gender as "MALE" | "FEMALE" | "OTHER" | undefined) || null,
          dob: body.dob ? new Date(body.dob) : null,
          classId: body.classId || null,
        },
      });

      if (body.guardian?.fullName && body.guardian?.phone) {
        const g = await tx.guardian.create({
          data: {
            institutionId: institution.id,
            fullName: body.guardian.fullName.trim(),
            phone: body.guardian.phone.trim(),
          },
        });
        await tx.studentGuardian.create({
          data: {
            studentId: s.id,
            guardianId: g.id,
            relation: body.guardian.relation ?? "parent",
            isPrimary: true,
          },
        });
      }

      if (body.tagIds?.length) {
        await tx.studentTag.createMany({
          data: body.tagIds.map(tagId => ({ studentId: s.id, tagId })),
          skipDuplicates: true,
        });
      }

      return s;
    });

    return NextResponse.json({ ok: true, student }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Failed to create student" }, { status: 500 });
  }
}
