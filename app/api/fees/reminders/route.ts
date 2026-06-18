import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { whatsappLink } from "@/lib/format/phone";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import type { Prisma } from "@prisma/client";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";
import { writeAuditEvent } from "@/lib/audit/server";

const remindSchema = z.object({
  scope:   z.enum(["overdue", "month", "selected"]),
  classId: z.string().optional(),
  month:   z.string().regex(/^\d{4}-\d{2}$/).optional(),
  invoiceIds: z.array(z.string()).max(500).optional(),
});

/**
 * Compose a fee-reminder body. Excludes any payment link/UPI handle.
 * Parents pay in person or via existing offline channels.
 */
function composeBody(opts: {
  guardianName: string | null;
  studentName: string;
  amount: number;
  dueDate: string;
  institutionName: string;
}): string {
  const greeting = opts.guardianName ? `Dear ${opts.guardianName}` : "Dear Parent";
  return `${greeting}, this is a friendly reminder that ${opts.studentName}'s fee of ${formatINR(opts.amount)} was due on ${formatDate(opts.dueDate)}. Kindly clear it at your earliest convenience. — ${opts.institutionName}`;
}

export async function POST(req: Request) {
  const requestId = requestIdFrom(req);
  let audit: { userId: string; institutionId: string } | null = null;
  try {
    const { user, institution, membership } = await requireApiInstitution();
    audit = { userId: user.id, institutionId: institution.id };
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)) {
      throw new ApiError(403, "FEE_REMINDER_FORBIDDEN", "You cannot create fee reminders");
    }
    await enforceRateLimit({
      scope: "fee-reminders",
      subject: `${institution.id}:${user.id}`,
      limit: 20,
      windowSeconds: 60 * 60,
    });
    const parsed = remindSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_REMINDER", parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { scope, classId, month, invoiceIds } = parsed.data;
    const today = new Date();

    const reminders = await withRls(user.id, async (tx) => {
      // Resolve target invoices
      const where: Prisma.InvoiceWhereInput = {
        institutionId: institution.id,
        status: { in: ["UNPAID", "PARTIAL"] },
      };

      if (scope === "overdue") {
        where.dueDate = { lt: today };
      } else if (scope === "month") {
        if (!month) throw new ApiError(400, "MONTH_REQUIRED", "Month is required");
        const [y, m] = month.split("-").map(Number);
        where.periodStart = { gte: new Date(y, m - 1, 1) };
        where.periodEnd   = { lte: new Date(y, m, 0) };
      } else if (scope === "selected") {
        if (!invoiceIds || invoiceIds.length === 0) {
          throw new ApiError(400, "INVOICES_REQUIRED", "Select at least one invoice");
        }
        where.id = { in: invoiceIds };
      }
      if (classId) where.student = { classId };

      const invoices = await tx.invoice.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              guardians: {
                where: { isPrimary: true },
                take: 1,
                include: { guardian: { select: { id: true, fullName: true, phone: true } } },
              },
            },
          },
        },
        take: 500,
      });

      const items = invoices
        .map(inv => {
          const g = inv.student.guardians[0]?.guardian;
          if (!g?.phone) return null;
          const remaining = inv.amountDue - inv.amountPaid;
          if (remaining <= 0) return null;
          const body = composeBody({
            guardianName:    g.fullName,
            studentName:     inv.student.fullName,
            amount:          remaining,
            dueDate:         inv.dueDate.toISOString().split("T")[0],
            institutionName: institution.name,
          });
          return {
            invoiceId:    inv.id,
            studentId:    inv.student.id,
            studentName:  inv.student.fullName,
            guardianName: g.fullName,
            guardianPhone: g.phone,
            amount: remaining,
            link:   whatsappLink(g.phone, body),
            body,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // Log each reminder as a queued Message row (audit trail)
      if (items.length > 0) {
        await tx.message.createMany({
          data: items.map(it => ({
            institutionId:     institution.id,
            recipientPhone:    it.guardianPhone,
            channel:           "WHATSAPP" as const,
            body:              it.body,
            status:            "QUEUED" as const,
            relatedEntityType: "invoice",
            relatedEntityId:   it.invoiceId,
          })),
        });
      }
      return items;
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "fee.reminders.prepare",
      outcome: "success",
      meta: { scope, total: reminders.length },
    });
    return NextResponse.json({ ok: true, reminders, total: reminders.length });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, { requestId });
    logServer("error", "fee.reminders.failed", { requestId, error: err, ...audit });
    return serverErrorResponse("Failed to prepare reminders", { requestId });
  }
}
