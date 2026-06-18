import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { assertRole } from "@/lib/auth/permissions";
import {
  assertAdmissionNoAvailable,
  assertStudentClass,
  normalizeAdmissionNo,
} from "@/lib/data-integrity/validation";
import { writeAuditEvent } from "@/lib/audit/server";

const studentSchema = z.object({
  fullName:    z.string().min(1, "Full name is required").max(200),
  admissionNo: z.string().max(50).optional(),
  gender:      z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dob:         z.string().optional(),
  classId:     z.string().optional(),
  guardian: z.object({
    fullName: z.string().min(1).max(200),
    phone:    z.string().min(10).max(15),
    relation: z.string().max(50).optional(),
  }).optional(),
  tagIds: z.array(z.string()).max(20).optional(),
});

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const { searchParams } = new URL(req.url);
    const q       = searchParams.get("q")?.trim() ?? "";
    const classId = searchParams.get("classId") ?? "";
    const status  = (searchParams.get("status") ?? "ACTIVE") as "ACTIVE" | "ARCHIVED";
    const cursor  = searchParams.get("cursor") ?? "";

    const { getTeacherClassIds } = await import("@/lib/tenant/teacher-scope");
    const teacherIds = await withRls(user.id, (tx) => getTeacherClassIds(tx, user.id, institution.id, membership.role));

    const where = {
      institutionId: institution.id,
      ...(status !== ("ALL" as string) ? { status } : {}),
      ...(classId ? { classId } : {}),
      ...(teacherIds !== null ? { classId: { in: teacherIds.length ? teacherIds : ["__none__"] } } : {}),
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
          class: { select: { id: true, name: true, section: true } },
          studentTags: { include: { tag: true } },
          guardians: {
            where: { isPrimary: true },
            include: { guardian: { select: { fullName: true, phone: true } } },
            take: 1,
          },
        },
        orderBy: [
          { class: { name: "asc" } },
          { admissionNo: { sort: "asc", nulls: "last" } },
          { fullName: "asc" },
        ],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    );

    const hasMore    = rows.length > PAGE_SIZE;
    const page       = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ ok: true, students: page, nextCursor });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to load students");
  }
}

export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireApiInstitution();
    assertRole(membership.role, ["OWNER", "ADMIN"], "STUDENT_CREATE_FORBIDDEN", "Only owners and admins can create students");
    const parsed = studentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

    const student = await withRls(user.id, async (tx) => {
      const admissionNo = normalizeAdmissionNo(body.admissionNo);
      await Promise.all([
        assertAdmissionNoAvailable(tx, institution.id, admissionNo),
        assertStudentClass(tx, institution.id, body.classId),
      ]);
      const s = await tx.student.create({
        data: {
          institutionId: institution.id,
          fullName: body.fullName.trim(),
          admissionNo,
          gender: body.gender ?? null,
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

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "student.create",
      targetId: student.id,
      outcome: "success",
      meta: { hasAdmissionNo: Boolean(student.admissionNo), classId: student.classId },
    });
    return NextResponse.json({ ok: true, student }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return serverErrorResponse("Failed to create student");
  }
}
