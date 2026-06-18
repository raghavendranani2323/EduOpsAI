import type { AttendanceStatus, Prisma } from "@prisma/client";
import { validateAttendanceStudents } from "@/lib/attendance/validation";

type AttendanceRecordInput = {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
};

export async function replaceAttendanceRecords(
  tx: Prisma.TransactionClient,
  input: {
    institutionId: string;
    classId: string;
    sessionDate: Date;
    sessionLabel: string;
    markedBy: string;
    records: AttendanceRecordInput[];
  },
) {
  await validateAttendanceStudents(tx, input.institutionId, input.classId, input.records);

  const session = await tx.attendanceSession.upsert({
    where: {
      classId_sessionDate_sessionLabel: {
        classId: input.classId,
        sessionDate: input.sessionDate,
        sessionLabel: input.sessionLabel,
      },
    },
    create: {
      institutionId: input.institutionId,
      classId: input.classId,
      sessionDate: input.sessionDate,
      sessionLabel: input.sessionLabel,
      markedBy: input.markedBy,
    },
    update: {
      markedAt: new Date(),
      markedBy: input.markedBy,
    },
  });

  await tx.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
  if (input.records.length > 0) {
    await tx.attendanceRecord.createMany({
      data: input.records.map((record) => ({
        sessionId: session.id,
        studentId: record.studentId,
        status: record.status,
        note: record.note ?? null,
      })),
    });
  }
  return session;
}
