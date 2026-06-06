import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { whatsappLink } from "@/lib/format/phone";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import type { Prisma } from "@prisma/client";

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
  try {
    const { user, institution } = await requireInstitution();
    const parsed = remindSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
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
        if (!month) throw new Error("month required");
        const [y, m] = month.split("-").map(Number);
        where.periodStart = { gte: new Date(y, m - 1, 1) };
        where.periodEnd   = { lte: new Date(y, m, 0) };
      } else if (scope === "selected") {
        if (!invoiceIds || invoiceIds.length === 0) throw new Error("invoiceIds required");
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

    return NextResponse.json({ ok: true, reminders, total: reminders.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to build reminders" }, { status: 500 });
  }
}
