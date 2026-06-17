import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { normalisePhone } from "@/lib/format/phone";

export function normalizeLeadPhone(phone: string) {
  const normalized = normalisePhone(phone.trim());
  if (!/^\+91[6-9]\d{9}$/.test(normalized)) {
    throw new ApiError(400, "INVALID_LEAD_PHONE", "Enter a valid Indian mobile number");
  }
  return normalized;
}

export async function assertLeadOwner(
  tx: Prisma.TransactionClient,
  institutionId: string,
  assignedToId?: string | null,
) {
  if (!assignedToId) return;
  const membership = await tx.membership.findFirst({
    where: {
      institutionId,
      userId: assignedToId,
      revokedAt: null,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new ApiError(400, "INVALID_LEAD_OWNER", "Lead owner must be an active owner or admin");
  }
}

export async function findLeadDuplicateSignals(
  tx: Prisma.TransactionClient,
  institutionId: string,
  input: { phone: string; studentName: string; excludeLeadId?: string },
) {
  const phone = normalizeLeadPhone(input.phone);
  const [leads, guardians] = await Promise.all([
    tx.lead.findMany({
      where: {
        institutionId,
        phone,
        ...(input.excludeLeadId ? { NOT: { id: input.excludeLeadId } } : {}),
      },
      select: { id: true, studentName: true, stage: true },
      take: 5,
    }),
    tx.guardian.findMany({
      where: { institutionId, phone },
      select: {
        students: {
          select: { student: { select: { id: true, fullName: true, status: true } } },
        },
      },
      take: 5,
    }),
  ]);

  const normalizedName = input.studentName.trim().toLocaleLowerCase("en-IN");
  const students = guardians
    .flatMap((guardian) => guardian.students.map((link) => link.student))
    .filter((student, index, all) => all.findIndex((item) => item.id === student.id) === index);

  return {
    phone,
    leadMatches: leads,
    studentMatches: students,
    strongStudentMatch: students.find(
      (student) => student.fullName.trim().toLocaleLowerCase("en-IN") === normalizedName,
    ) ?? null,
  };
}

export async function addLeadActivity(
  tx: Prisma.TransactionClient,
  data: {
    institutionId: string;
    leadId: string;
    actorUserId: string;
    kind:
      | "CREATED"
      | "NOTE"
      | "CALL"
      | "WHATSAPP"
      | "STAGE_CHANGED"
      | "FOLLOWUP_CHANGED"
      | "OWNER_CHANGED"
      | "CONVERTED"
      | "LINKED_EXISTING";
    note?: string | null;
    meta?: Prisma.InputJsonValue;
  },
) {
  return tx.leadActivity.create({
    data: {
      institutionId: data.institutionId,
      leadId: data.leadId,
      actorUserId: data.actorUserId,
      kind: data.kind,
      note: data.note?.trim() || null,
      ...(data.meta !== undefined ? { meta: data.meta } : {}),
    },
  });
}
