import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";
import { writeAuditEvent } from "@/lib/audit/server";

const importSchema = z.object({
  students: z.array(z.object({
    fullName: z.string().trim().min(1).max(200),
    admissionNo: z.string().trim().max(100).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    classId: z.string().max(191).optional(),
    guardianName: z.string().trim().max(200).optional(),
    guardianPhone: z.string().trim().max(20).optional(),
  })).min(1).max(500),
});

export async function POST(req: Request) {
  const requestId = requestIdFrom(req);
  let audit: { userId: string; institutionId: string } | null = null;
  try {
    const { user, institution, membership } = await requireApiInstitution();
    audit = { userId: user.id, institutionId: institution.id };
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new ApiError(403, "STUDENT_IMPORT_FORBIDDEN", "Only owners and admins can import students");
    }
    await enforceRateLimit({
      scope: "student-import",
      subject: `${institution.id}:${user.id}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });
    const parsed = importSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_IMPORT", parsed.error.issues[0]?.message ?? "Invalid import");
    }
    const { students } = parsed.data;

    const rows = students;
    let imported = 0;
    let errors   = 0;

    for (const row of rows) {
      try {
        await withRls(user.id, async (tx) => {
          const student = await tx.student.create({
            data: {
              institutionId: institution.id,
              fullName:      row.fullName.trim(),
              admissionNo:   row.admissionNo?.trim() || null,
              gender:        (["MALE", "FEMALE", "OTHER"].includes(row.gender ?? "")) ? row.gender as "MALE" | "FEMALE" | "OTHER" : null,
              classId:       row.classId || null,
            },
          });

          if (row.guardianName?.trim() && row.guardianPhone?.trim()) {
            const g = await tx.guardian.create({
              data: {
                institutionId: institution.id,
                fullName: row.guardianName.trim(),
                phone:    row.guardianPhone.trim(),
              },
            });
            await tx.studentGuardian.create({
              data: { studentId: student.id, guardianId: g.id, isPrimary: true },
            });
          }
        });
        imported++;
      } catch {
        errors++;
      }
    }

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "students.import",
      outcome: errors ? "failure" : "success",
      meta: { requested: rows.length, imported, errors },
    });
    return NextResponse.json({ ok: true, imported, errors });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, { requestId });
    logServer("error", "students.import.failed", { requestId, error: err, ...audit });
    return serverErrorResponse("Failed to import students", { requestId });
  }
}
