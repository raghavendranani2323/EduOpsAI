import "server-only";

import type { Prisma, Role } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { getTeacherClassIds } from "@/lib/tenant/teacher-scope";

type PrismaTx = Prisma.TransactionClient;

export function assertRole(
  role: Role,
  allowed: readonly Role[],
  code = "FORBIDDEN",
  message = "You do not have permission to perform this action",
) {
  if (!allowed.includes(role)) {
    throw new ApiError(403, code, message);
  }
}

export async function authorizedClassIds(
  tx: PrismaTx,
  userId: string,
  institutionId: string,
  role: Role,
) {
  if (role === "OWNER" || role === "ADMIN") return null;
  if (role === "TEACHER") {
    return (await getTeacherClassIds(tx, userId, institutionId, role)) ?? [];
  }
  throw new ApiError(403, "ACADEMIC_ACCESS_FORBIDDEN", "Academic records are not available for this role");
}

export async function assertClassAccess(
  tx: PrismaTx,
  input: {
    userId: string;
    institutionId: string;
    role: Role;
    classId: string;
  },
) {
  const cls = await tx.class.findFirst({
    where: { id: input.classId, institutionId: input.institutionId },
    select: { id: true },
  });
  if (!cls) throw new ApiError(404, "CLASS_NOT_FOUND", "Class not found");

  const ids = await authorizedClassIds(
    tx,
    input.userId,
    input.institutionId,
    input.role,
  );
  if (ids !== null && !ids.includes(input.classId)) {
    throw new ApiError(403, "CLASS_ACCESS_FORBIDDEN", "You do not have access to this class");
  }
  return cls;
}
