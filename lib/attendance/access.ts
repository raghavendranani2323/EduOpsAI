import type { Prisma, Role } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";

type Tx = Prisma.TransactionClient;

export const ATTENDANCE_ALLOWED_ROLES: Role[] = ["OWNER", "ADMIN", "TEACHER"];

export async function getAttendanceAccessibleClassIds(
  tx: Tx,
  userId: string,
  institutionId: string,
  role: Role,
) {
  if (role === "OWNER" || role === "ADMIN") return null;
  if (role === "TEACHER") return getTeacherClassIds(tx, userId, institutionId, role);
  return [];
}

export async function requireAttendanceClassAccess(
  tx: Tx,
  userId: string,
  institutionId: string,
  role: Role,
  classId: string,
) {
  if (!ATTENDANCE_ALLOWED_ROLES.includes(role)) {
    throw new ApiError(403, "ATTENDANCE_FORBIDDEN", "You do not have access to attendance");
  }

  const cls = await tx.class.findFirst({
    where: { id: classId, institutionId },
    select: { id: true, name: true, section: true, institutionId: true },
  });
  if (!cls) {
    throw new ApiError(404, "CLASS_NOT_FOUND", "Class not found");
  }

  if (role === "TEACHER") {
    const ids = await getTeacherClassIds(tx, userId, institutionId, role);
    if (!ids?.includes(classId)) {
      throw new ApiError(403, "ATTENDANCE_CLASS_FORBIDDEN", "You do not teach this class");
    }
  }

  return cls;
}

