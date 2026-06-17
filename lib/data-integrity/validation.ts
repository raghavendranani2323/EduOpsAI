import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";

export function normalizeAdmissionNo(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function assertAdmissionNoAvailable(
  tx: Prisma.TransactionClient,
  institutionId: string,
  admissionNo: string | null,
  excludeStudentId?: string,
) {
  if (!admissionNo) return;

  const existing = await tx.student.findFirst({
    where: {
      institutionId,
      admissionNo: { equals: admissionNo, mode: "insensitive" },
      ...(excludeStudentId ? { NOT: { id: excludeStudentId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(
      409,
      "ADMISSION_NUMBER_EXISTS",
      "Admission number is already used by another student",
    );
  }
}

export async function assertStudentClass(
  tx: Prisma.TransactionClient,
  institutionId: string,
  classId?: string | null,
) {
  if (!classId) return;
  const found = await tx.class.findFirst({
    where: { id: classId, institutionId },
    select: { id: true },
  });
  if (!found) {
    throw new ApiError(400, "INVALID_STUDENT_CLASS", "Selected class is not valid");
  }
}

export function validateTimetableRange(dayOfWeek: number, startTime: string, endTime: string) {
  if (
    !Number.isInteger(dayOfWeek)
    || dayOfWeek < 1
    || dayOfWeek > 7
    || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)
    || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)
    || startTime >= endTime
  ) {
    throw new ApiError(400, "INVALID_TIMETABLE_RANGE", "Enter a valid day and time range");
  }
}

export async function assertTimetableReferencesAndAvailability(
  tx: Prisma.TransactionClient,
  input: {
    institutionId: string;
    classId: string;
    subjectId?: string | null;
    teacherId?: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    excludeSlotId?: string;
  },
) {
  validateTimetableRange(input.dayOfWeek, input.startTime, input.endTime);

  const [classRow, subjectRow, teacherMembership] = await Promise.all([
    tx.class.findFirst({
      where: { id: input.classId, institutionId: input.institutionId },
      select: { id: true },
    }),
    input.subjectId
      ? tx.subject.findFirst({
          where: {
            id: input.subjectId,
            institutionId: input.institutionId,
            OR: [{ classId: null }, { classId: input.classId }],
          },
          select: { id: true },
        })
      : Promise.resolve({ id: "none" }),
    input.teacherId
      ? tx.membership.findFirst({
          where: {
            userId: input.teacherId,
            institutionId: input.institutionId,
            revokedAt: null,
            role: { in: ["OWNER", "ADMIN", "TEACHER"] },
          },
          select: { id: true },
        })
      : Promise.resolve({ id: "none" }),
  ]);

  if (!classRow || !subjectRow || !teacherMembership) {
    throw new ApiError(
      400,
      "INVALID_TIMETABLE_REFERENCE",
      "Class, subject, or teacher is not valid for this institution",
    );
  }

  const overlap = await tx.timetableSlot.findFirst({
    where: {
      institutionId: input.institutionId,
      dayOfWeek: input.dayOfWeek,
      ...(input.excludeSlotId ? { NOT: { id: input.excludeSlotId } } : {}),
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime },
      OR: [
        { classId: input.classId },
        ...(input.teacherId ? [{ teacherId: input.teacherId }] : []),
      ],
    },
    select: { id: true },
  });
  if (overlap) {
    throw new ApiError(
      409,
      "TIMETABLE_CONFLICT",
      "This class or teacher already has an overlapping timetable slot",
    );
  }
}
