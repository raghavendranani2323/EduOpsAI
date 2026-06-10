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

    // "all" disables the period filter; OVERDUE is always cross-month so the
    // list matches the Overdue KPI on the fees page.
    let periodFilter = {};
    if (month && month !== "all" && status !== "OVERDUE") {
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

// POST — bulk generate invoices for a plan + classes + period, applying sibling discount
export async function POST(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json() as {
      planId:       string;
      classIds:     string[] | null;
      periodStart:  string;
      periodEnd:    string;
      dueDate:      string;
      dryRun?:      boolean;
    };

    const { planId, classIds, periodStart, periodEnd, dueDate, dryRun } = body;
    if (!planId || !periodStart || !periodEnd || !dueDate) {
      return NextResponse.json({ ok: false, error: "planId, periodStart, periodEnd, dueDate required" }, { status: 400 });
    }

    // Sibling discount tiers from institution settings — sorted desc by nth so
    // we pick the steepest tier the student qualifies for.
    interface DiscountTier { nth: number; percent: number }
    const rawTiers = Array.isArray(institution.siblingDiscounts) ? institution.siblingDiscounts : [];
    const tiers: DiscountTier[] = rawTiers
      .filter((t): t is { nth: number; percent: number } =>
        !!t && typeof t === "object" && "nth" in t && "percent" in t &&
        typeof (t as Record<string, unknown>).nth === "number" &&
        typeof (t as Record<string, unknown>).percent === "number",
      )
      .map(t => ({ nth: t.nth, percent: t.percent }))
      .sort((a, b) => b.nth - a.nth);

    function discountFor(ordinal: number): number {
      if (ordinal <= 1) return 0;
      const tier = tiers.find(t => ordinal >= t.nth);
      return tier?.percent ?? 0;
    }

    const result = await withRls(user.id, async (tx) => {
      const plan = await tx.feePlan.findFirst({ where: { id: planId, institutionId: institution.id } });
      if (!plan) throw new Error("Plan not found");

      const studentWhere = {
        institutionId: institution.id,
        status: "ACTIVE" as const,
        ...(classIds?.length ? { classId: { in: classIds } } : {}),
      };
      const students = await tx.student.findMany({
        where: studentWhere,
        include: {
          guardians: {
            where: { isPrimary: true },
            include: { guardian: { select: { phone: true, id: true } } },
            take: 1,
          },
        },
      });

      // Group siblings by primary guardian phone (canonicalised to last-10 digits)
      function canonPhone(p: string | null | undefined) {
        if (!p) return null;
        const d = p.replace(/\D/g, "");
        return d.slice(-10) || null;
      }
      const familyOrdinal = new Map<string, number>(); // canonicalPhone -> next ordinal (starts at 1)

      // Sort students by createdAt for stable sibling ordering
      students.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const pStart = new Date(periodStart);
      const pEnd   = new Date(periodEnd);
      const due    = new Date(dueDate);

      let created = 0, skipped = 0, discounted = 0;
      const preview: Array<{ studentId: string; fullName: string; amountDue: number; ordinal: number; discountPercent: number; skipped: boolean }> = [];

      for (const student of students) {
        const exists = await tx.invoice.findFirst({
          where: {
            institutionId: institution.id,
            studentId:     student.id,
            feePlanId:     planId,
            periodStart:   pStart,
            periodEnd:     pEnd,
          },
        });

        const phone = canonPhone(student.guardians[0]?.guardian.phone);
        let ordinal = 1;
        if (phone) {
          ordinal = (familyOrdinal.get(phone) ?? 0) + 1;
          familyOrdinal.set(phone, ordinal);
        }
        const discountPct = discountFor(ordinal);
        const amountDue = Math.max(0, Math.round(plan.amount * (100 - discountPct) / 100));

        if (exists) {
          skipped++;
          preview.push({ studentId: student.id, fullName: student.fullName, amountDue, ordinal, discountPercent: discountPct, skipped: true });
          continue;
        }
        if (discountPct > 0) discounted++;
        preview.push({ studentId: student.id, fullName: student.fullName, amountDue, ordinal, discountPercent: discountPct, skipped: false });

        if (!dryRun) {
          await tx.invoice.create({
            data: {
              institutionId: institution.id,
              studentId:     student.id,
              feePlanId:     planId,
              amountDue,
              amountPaid:    0,
              status:        "UNPAID",
              periodStart:   pStart,
              periodEnd:     pEnd,
              dueDate:       due,
              notes:         discountPct > 0 ? `Sibling discount: ${discountPct}% (child #${ordinal})` : null,
            },
          });
          created++;
        }
      }
      return { created, skipped, discounted, preview, total: students.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
