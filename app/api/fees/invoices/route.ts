import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

// GET — paginated invoice list (used by fees page as well)
export async function GET(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const status  = searchParams.get("status") ?? "ALL";
    const classId = searchParams.get("classId") ?? "";
    const month   = searchParams.get("month") ?? "";
    const q       = searchParams.get("q")?.trim() ?? "";
    const cursor  = searchParams.get("cursor") ?? "";
    const PAGE_SIZE = 50;

    let periodFilter = {};
    if (month) {
      const [y, m] = month.split("-").map(Number);
      periodFilter = {
        periodStart: { gte: new Date(y, m - 1, 1) },
        periodEnd:   { lte: new Date(y, m, 0) },
      };
    }

    const where = {
      institutionId: institution.id,
      ...periodFilter,
      ...(classId ? { student: { classId } } : {}),
      ...(q ? { student: { fullName: { contains: q, mode: "insensitive" as const } } } : {}),
      ...(status !== "ALL" && status !== "OVERDUE" ? { status: status as "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED" } : {}),
      ...(status === "OVERDUE" ? { status: { in: ["UNPAID" as const, "PARTIAL" as const] }, dueDate: { lt: new Date() } } : {}),
    };

    const rows = await withRls(user.id, (tx) =>
      tx.invoice.findMany({
        where,
        include: { student: { select: { id: true, fullName: true, admissionNo: true, class: { select: { name: true } } } } },
        orderBy: { dueDate: "asc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    );

    const hasMore    = rows.length > PAGE_SIZE;
    const page       = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ ok: true, invoices: page, nextCursor });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}

// POST — bulk generate invoices for a plan + classes + period
export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as {
      planId:       string;
      classIds:     string[] | null;
      periodStart:  string;
      periodEnd:    string;
      dueDate:      string;
    };

    const { planId, classIds, periodStart, periodEnd, dueDate } = body;
    if (!planId || !periodStart || !periodEnd || !dueDate) {
      return NextResponse.json({ ok: false, error: "planId, periodStart, periodEnd, dueDate required" }, { status: 400 });
    }

    const { created, skipped } = await withRls(user.id, async (tx) => {
      // Verify plan belongs to institution
      const plan = await tx.feePlan.findFirst({ where: { id: planId, institutionId: institution.id } });
      if (!plan) throw new Error("Plan not found");

      // Fetch students
      const studentWhere = {
        institutionId: institution.id,
        status: "ACTIVE" as const,
        ...(classIds?.length ? { classId: { in: classIds } } : {}),
      };
      const students = await tx.student.findMany({ where: studentWhere, select: { id: true } });

      const pStart = new Date(periodStart);
      const pEnd   = new Date(periodEnd);
      const due    = new Date(dueDate);

      let created = 0, skipped = 0;
      for (const student of students) {
        // Skip if invoice already exists for this student + period + plan
        const exists = await tx.invoice.findFirst({
          where: {
            institutionId: institution.id,
            studentId:     student.id,
            feePlanId:     planId,
            periodStart:   pStart,
            periodEnd:     pEnd,
          },
        });
        if (exists) { skipped++; continue; }

        await tx.invoice.create({
          data: {
            institutionId: institution.id,
            studentId:     student.id,
            feePlanId:     planId,
            amountDue:     plan.amount,
            amountPaid:    0,
            status:        "UNPAID",
            periodStart:   pStart,
            periodEnd:     pEnd,
            dueDate:       due,
          },
        });
        created++;
      }
      return { created, skipped };
    });

    return NextResponse.json({ ok: true, created, skipped });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
