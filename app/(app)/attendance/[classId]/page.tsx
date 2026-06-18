import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTerminology } from "@/lib/i18n/terminology";
import { todayIST, formatDateLong } from "@/lib/format/date";
import { AttendanceSheet } from "./attendance-sheet";
import { AttendanceHistory } from "./attendance-history";
import { Prisma } from "@prisma/client";
import type { AttendanceRecord } from "@prisma/client";
import { requireAttendanceClassAccess } from "@/lib/attendance/access";
import { parseAttendanceDate } from "@/lib/attendance/validation";

type SessionWithRecords = Prisma.AttendanceSessionGetPayload<{
  include: { records: { select: { status: true } } };
}>;

export default async function AttendanceClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { classId } = await params;
  const sp     = await searchParams;
  const view   = sp.view ?? "mark";
  const today  = todayIST();
  const date   = sp.date ?? today;

  const { user, institution, membership } = await requireInstitution();
  const t = getTerminology(institution.type);
  let sessionDate: Date;
  try {
    sessionDate = parseAttendanceDate(date);
  } catch {
    notFound();
  }

  const { cls, students, existingSession, existingRecords, yesterdayRecords, history } = await withRls(user.id, async (tx) => {
    const cls = await requireAttendanceClassAccess(tx, user.id, institution.id, membership.role, classId)
      .catch(() => null);
    if (!cls) return { cls: null, students: [], existingSession: null, existingRecords: [], yesterdayRecords: [], history: [] };

    const yesterday = new Date(sessionDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const [students, existingSession, yesterdaySession] = await Promise.all([
      tx.student.findMany({
        where: { institutionId: institution.id, classId, status: "ACTIVE" },
        // Roll-order: teachers call out the register by admission no.
        orderBy: [{ admissionNo: { sort: "asc", nulls: "last" } }, { fullName: "asc" }],
        select: { id: true, fullName: true, admissionNo: true, gender: true },
      }),
      tx.attendanceSession.findFirst({
        where: { classId, sessionDate },
        include: { records: true },
      }),
      tx.attendanceSession.findFirst({
        where: { classId, sessionDate: yesterday },
        include: { records: { select: { studentId: true, status: true } } },
      }),
    ]);

    // History: last 30 days
    const thirtyDaysAgo = new Date(sessionDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const historySessions = view === "history"
      ? await tx.attendanceSession.findMany({
          where: {
            classId,
            institutionId: institution.id,
            sessionDate: { gte: thirtyDaysAgo, lte: sessionDate },
          },
          include: { records: { select: { status: true } } },
          orderBy: { sessionDate: "desc" },
        })
      : [];

    const history = historySessions.map((s: SessionWithRecords) => ({
      date:    (s.sessionDate as Date).toISOString().split("T")[0],
      present: s.records.filter(r => r.status === "PRESENT").length,
      absent:  s.records.filter(r => r.status === "ABSENT").length,
      late:    s.records.filter(r => r.status === "LATE").length,
      halfDay: s.records.filter(r => r.status === "HALF_DAY").length,
      total:   students.length,
    }));

    return {
      cls,
      students,
      existingSession,
      existingRecords: existingSession?.records ?? [],
      yesterdayRecords: yesterdaySession?.records ?? [],
      history,
    };
  });

  if (!cls) notFound();

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background sticky top-0 z-10">
        <Link href="/attendance" aria-label="Back to attendance classes" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold truncate">{cls.name}</h1>
          <p className="text-xs text-muted-foreground">{formatDateLong(date)}</p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
          <Link
            href={`/attendance/${classId}?date=${date}&view=mark`}
            className={`px-3 py-2 min-h-[36px] flex items-center ${view === "mark" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Mark
          </Link>
          <Link
            href={`/attendance/${classId}?date=${date}&view=history`}
            className={`px-3 py-2 min-h-[36px] flex items-center ${view === "history" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            History
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {view === "history" ? (
          <AttendanceHistory
            history={history}
            className={cls.name}
            terminology={t}
          />
        ) : (
          <AttendanceSheet
            classId={classId}
            date={date}
            students={students}
            existingRecords={existingRecords.map((r: AttendanceRecord) => ({ studentId: r.studentId, status: r.status, note: r.note ?? undefined }))}
            yesterdayRecords={yesterdayRecords.map(r => ({ studentId: r.studentId, status: r.status }))}
            isEdit={!!existingSession}
            expectedUpdatedAt={existingSession?.markedAt.toISOString() ?? null}
            terminology={t}
          />
        )}
      </div>
    </div>
  );
}
