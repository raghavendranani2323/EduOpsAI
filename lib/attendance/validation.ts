import type { AttendanceStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";

type Tx = Prisma.TransactionClient;

export interface AttendanceInputRecord {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

export function parseAttendanceDate(input: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new ApiError(400, "INVALID_DATE", "Enter a valid attendance date");
  }
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new ApiError(400, "INVALID_DATE", "Enter a valid attendance date");
  }
  return date;
}

export function assertNoDuplicateStudentIds(records: AttendanceInputRecord[]) {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.studentId)) {
      throw new ApiError(400, "DUPLICATE_STUDENT", "Each student can appear only once");
    }
    seen.add(record.studentId);
  }
}

export async function validateAttendanceStudents(
  tx: Tx,
  institutionId: string,
  classId: string,
  records: AttendanceInputRecord[],
) {
  assertNoDuplicateStudentIds(records);
  if (records.length === 0) return;

  const submittedIds = records.map((record) => record.studentId);
  const validStudents = await tx.student.findMany({
    where: {
      id: { in: submittedIds },
      institutionId,
      classId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (validStudents.length !== submittedIds.length) {
    throw new ApiError(
      400,
      "INVALID_ATTENDANCE_STUDENTS",
      "Attendance includes students who are not active in this class",
    );
  }
}

