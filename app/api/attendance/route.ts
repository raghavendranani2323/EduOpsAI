import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { whatsappLink } from "@/lib/format/phone";
import { formatDateLong } from "@/lib/format/date";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";
import { requireAttendanceClassAccess } from "@/lib/attendance/access";
import { parseAttendanceDate } from "@/lib/attendance/validation";
import { replaceAttendanceRecords } from "@/lib/attendance/save";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";

const attendanceSchema = z.object({
  classId:      z.string().min(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  sessionLabel: z.string().max(20).optional(),
  records: z.array(z.object({
    studentId: z.string().min(1),
    status:    z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY"]),
    note:      z.string().max(500).optional(),
  })).max(500),
});

export async function GET(req: Request) {
  const requestId = requestIdFrom(req);
  let audit:
    | { actorUserId: string; institutionId: string; classId?: string | null; date?: string | null }
    | null = null;
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date    = searchParams.get("date");
    audit = { actorUserId: user.id, institutionId: institution.id, classId, date };

    if (!classId || !date) {
      return NextResponse.json({ ok: false, error: "classId and date are required" }, { status: 400 });
    }
    const sessionDate = parseAttendanceDate(date);

    const session = await withRls(user.id, async (tx) => {
      await requireAttendanceClassAccess(tx, user.id, institution.id, membership.role, classId);
      return tx.attendanceSession.findFirst({
        where: {
          classId,
          institutionId: institution.id,
          sessionDate,
        },
        include: { records: true },
      });
    });

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    if (err instanceof ApiError) {
      if (audit && err.status === 403) {
        await writeAuditEvent({
          actorUserId: audit.actorUserId,
          institutionId: audit.institutionId,
          action: "attendance.read.denied",
          targetId: audit.classId ?? null,
          outcome: "denied",
          meta: { code: err.code, date: audit.date },
        });
      }
      return errorResponse(err, { requestId });
    }
    logServer("error", "attendance.read.failed", { requestId, error: err });
    return serverErrorResponse("Failed to load attendance", { requestId });
  }
}

export async function POST(req: Request) {
  const requestId = requestIdFrom(req);
  let audit:
    | { actorUserId: string; institutionId: string; classId?: string | null; date?: string | null }
    | null = null;
  try {
    const { user, institution, membership } = await requireApiInstitution();
    const parsed = attendanceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { classId, date, records } = parsed.data;
    audit = { actorUserId: user.id, institutionId: institution.id, classId, date };
    const sessionLabel = parsed.data.sessionLabel ?? "morning";
    const sessionDate = parseAttendanceDate(date);
    const cleaned = records;

    const session = await withRls(user.id, async (tx) => {
      await requireAttendanceClassAccess(tx, user.id, institution.id, membership.role, classId);
      return replaceAttendanceRecords(tx, {
        institutionId: institution.id,
        classId,
        sessionDate,
        sessionLabel,
        markedBy: user.id,
        records: cleaned,
      });
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "attendance.save",
      targetId: session.id,
      outcome: "success",
      meta: {
        classId,
        date,
        sessionLabel,
        recordCount: cleaned.length,
      },
    });

    // Build absent-alert payload: WhatsApp deep-links for primary guardians of absent students.
    const absentIds = cleaned.filter(r => r.status === "ABSENT").map(r => r.studentId);
    const absentees = absentIds.length
      ? await withRls(user.id, (tx) =>
          tx.student.findMany({
            where: { id: { in: absentIds }, institutionId: institution.id },
            select: {
              id: true,
              fullName: true,
              guardians: {
                where: { isPrimary: true },
                take: 1,
                include: { guardian: { select: { fullName: true, phone: true } } },
              },
            },
          })
        )
      : [];

    const dateLabel = formatDateLong(date);
    const alerts = absentees
      .map(s => {
        const g = s.guardians[0]?.guardian;
        if (!g?.phone) return null;
        const body = `Dear ${g.fullName ?? "Parent"}, this is to inform you that ${s.fullName} was marked absent today (${dateLabel}) at ${institution.name}. Please contact us if this is unexpected.`;
        return {
          studentId: s.id,
          studentName: s.fullName,
          guardianName: g.fullName,
          guardianPhone: g.phone,
          link: whatsappLink(g.phone, body),
          body,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({ ok: true, sessionId: session.id, alerts });
  } catch (err) {
    if (err instanceof ApiError) {
      if (audit && [400, 403, 404].includes(err.status)) {
        await writeAuditEvent({
          actorUserId: audit.actorUserId,
          institutionId: audit.institutionId,
          action: "attendance.save.denied",
          targetId: audit.classId ?? null,
          outcome: "denied",
          meta: { code: err.code, date: audit.date },
        });
      }
      return errorResponse(err, { requestId });
    }
    logServer("error", "attendance.save.failed", { requestId, error: err, ...audit });
    if (audit) {
      await writeAuditEvent({
        actorUserId: audit.actorUserId,
        institutionId: audit.institutionId,
        action: "attendance.save",
        targetId: audit.classId ?? null,
        outcome: "failure",
        meta: { date: audit.date },
      });
    }
    return serverErrorResponse("Failed to save attendance", { requestId });
  }
}
