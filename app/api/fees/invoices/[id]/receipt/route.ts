import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { withRls } from "@/lib/prisma/rls";
import { formatINR } from "@/lib/format/currency";
import { formatDate, formatDateLong } from "@/lib/format/date";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function assignReceiptNumber(invoiceId: string, institutionId: string, prefix: string): Promise<string> {
  // Atomic increment with returning
  const rows = await prismaAdmin.$queryRawUnsafe<Array<{ receiptCounter: number }>>(
    `UPDATE institutions SET "receiptCounter" = "receiptCounter" + 1, "updatedAt" = NOW()
     WHERE id = $1 RETURNING "receiptCounter"`,
    institutionId,
  );
  const n = rows[0]?.receiptCounter ?? 1;
  const number = `${prefix}-${String(n).padStart(4, "0")}`;
  await prismaAdmin.invoice.update({ where: { id: invoiceId }, data: { receiptNumber: number } });
  return number;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, institution } = await requireInstitution();

  const invoice = await withRls(user.id, (tx) =>
    tx.invoice.findFirst({
      where: { id, institutionId: institution.id },
      include: {
        student: {
          include: {
            class:    { select: { name: true, section: true } },
            guardians: { where: { isPrimary: true }, include: { guardian: { select: { fullName: true, phone: true } } }, take: 1 },
          },
        },
        feePlan: { include: { components: { orderBy: { order: "asc" } } } },
        payments: { orderBy: { paidAt: "asc" } },
      },
    }),
  );

  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  const inst = await prismaAdmin.institution.findUnique({ where: { id: institution.id } });
  if (!inst) return new NextResponse("Institution missing", { status: 404 });

  // Assign a receipt number if not present and there's at least one payment
  let receiptNumber = invoice.receiptNumber;
  if (!receiptNumber && invoice.payments.length > 0) {
    receiptNumber = await assignReceiptNumber(invoice.id, institution.id, inst.receiptPrefix ?? "INV");
  }

  const guardian = invoice.student.guardians[0]?.guardian ?? null;
  const className = [invoice.student.class?.name, invoice.student.class?.section].filter(Boolean).join(" – ");
  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = invoice.amountDue - totalPaid;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(receiptNumber ?? invoice.id.slice(0, 8))}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --primary: #6366f1; --ok: #16a34a; --warn: #d97706; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; margin: 0; padding: 24px; color: var(--ink); background: #f8fafc; font-size: 14px; line-height: 1.45; }
  .wrap { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(15,23,42,0.05); }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 2px solid var(--ink); }
  .logo { max-width: 64px; max-height: 64px; border-radius: 8px; }
  .inst h1 { margin: 0; font-size: 18px; letter-spacing: -0.01em; }
  .inst p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
  .receipt-info { text-align: right; font-size: 12px; color: var(--muted); }
  .receipt-info .num { font-family: ui-monospace, "JetBrains Mono", monospace; color: var(--ink); font-size: 16px; font-weight: 700; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .status.paid { background: rgba(22,163,74,0.12); color: var(--ok); }
  .status.partial { background: rgba(217,119,6,0.12); color: var(--warn); }
  .status.unpaid { background: rgba(15,23,42,0.08); color: var(--muted); }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 18px 0; border-bottom: 1px solid var(--line); }
  .meta h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.06em; font-weight: 700; }
  .meta p { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: 18px 0 10px; }
  th, td { padding: 10px 8px; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--line); letter-spacing: 0.04em; font-weight: 700; }
  td { border-bottom: 1px solid var(--line); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { padding-top: 12px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
  .totals .row.grand { padding: 10px 0 0; border-top: 1px solid var(--line); margin-top: 6px; font-weight: 700; font-size: 16px; }
  .totals .row.remaining { font-weight: 700; color: var(--warn); }
  .pay-history { margin-top: 18px; }
  .pay-history h3 { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.06em; font-weight: 700; }
  .pay-history table th, .pay-history table td { font-size: 13px; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
  .footer .gst { font-family: ui-monospace, monospace; }
  .actions { position: fixed; bottom: 20px; right: 20px; display: flex; gap: 8px; }
  .btn { background: var(--primary); color: #fff; border: 0; padding: 12px 16px; border-radius: 10px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,0.4); font-size: 14px; }
  .btn.alt { background: #fff; color: var(--ink); border: 1px solid var(--line); }
  @media print {
    body { background: #fff; padding: 0; }
    .wrap { box-shadow: none; padding: 0; max-width: 100%; }
    .actions { display: none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div style="display: flex; gap: 14px; align-items: flex-start;">
      ${inst.logoUrl ? `<img src="${esc(inst.logoUrl)}" alt="" class="logo" />` : ""}
      <div class="inst">
        <h1>${esc(inst.name)}</h1>
        ${[inst.addressLine1, inst.addressLine2, [inst.city, inst.state, inst.pincode].filter(Boolean).join(", ")].filter(Boolean).map(l => `<p>${esc(l)}</p>`).join("")}
        ${inst.phone ? `<p>Tel: ${esc(inst.phone)}</p>` : ""}
        ${inst.affiliationNo ? `<p>${esc(inst.board ?? "")} — Affiliation no. ${esc(inst.affiliationNo)}</p>` : (inst.board ? `<p>${esc(inst.board)}</p>` : "")}
      </div>
    </div>
    <div class="receipt-info">
      <p>FEE RECEIPT</p>
      <p class="num">${esc(receiptNumber ?? "Pending")}</p>
      <p style="margin-top: 8px;">Issued ${esc(formatDate(new Date()))}</p>
      <p style="margin-top: 4px;">
        <span class="status ${invoice.status.toLowerCase()}">${esc(invoice.status)}</span>
      </p>
    </div>
  </div>

  <div class="meta">
    <div>
      <h3>Billed to</h3>
      <p style="font-weight: 600; font-size: 15px;">${esc(invoice.student.fullName)}</p>
      ${invoice.student.admissionNo ? `<p>Adm. no. ${esc(invoice.student.admissionNo)}</p>` : ""}
      ${className ? `<p>${esc(className)}</p>` : ""}
      ${guardian ? `<p>Guardian: ${esc(guardian.fullName)} · ${esc(guardian.phone)}</p>` : ""}
    </div>
    <div>
      <h3>Plan</h3>
      <p style="font-weight: 600;">${esc(invoice.feePlan?.name ?? "Ad-hoc invoice")}</p>
      ${invoice.feePlan ? `<p>${esc(invoice.feePlan.cadence.toLowerCase())}</p>` : ""}
      ${invoice.periodStart ? `<p>Period: ${esc(formatDate(invoice.periodStart))}${invoice.periodEnd ? " – " + esc(formatDate(invoice.periodEnd)) : ""}</p>` : ""}
      <p>Due ${esc(formatDateLong(invoice.dueDate))}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Particulars</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${(invoice.feePlan?.components ?? []).map(c => `
        <tr>
          <td>${esc(c.name)}${c.isOptional ? ` <span style="color:var(--muted); font-size:11px;">(optional)</span>` : ""}</td>
          <td class="num">${esc(formatINR(c.amount))}</td>
        </tr>
      `).join("")}
      ${(invoice.feePlan?.components.length ?? 0) === 0 ? `
        <tr>
          <td>${esc(invoice.feePlan?.name ?? "Fees")}</td>
          <td class="num">${esc(formatINR(invoice.amountDue))}</td>
        </tr>
      ` : ""}
      ${invoice.notes ? `
        <tr>
          <td style="color: var(--ok); font-size: 12px;">${esc(invoice.notes)}</td>
          <td class="num" style="color: var(--ok); font-size: 12px;">Applied</td>
        </tr>
      ` : ""}
    </tbody>
  </table>

  <div class="totals">
    <div class="row grand">
      <span>Total payable</span>
      <span>${esc(formatINR(invoice.amountDue))}</span>
    </div>
    ${totalPaid > 0 ? `
    <div class="row">
      <span>Paid</span>
      <span style="color: var(--ok);">${esc(formatINR(totalPaid))}</span>
    </div>
    ` : ""}
    ${remaining > 0 ? `
    <div class="row remaining">
      <span>Balance due</span>
      <span>${esc(formatINR(remaining))}</span>
    </div>
    ` : ""}
  </div>

  ${invoice.payments.length > 0 ? `
  <div class="pay-history">
    <h3>Payment history</h3>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Mode</th>
          <th>Reference</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.payments.map(p => `
          <tr>
            <td>${esc(formatDate(p.paidAt))}</td>
            <td>${esc(p.mode.replace(/_/g, " "))}</td>
            <td>${esc(p.referenceNo ?? "—")}</td>
            <td class="num">${esc(formatINR(p.amount))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <div class="footer">
    <div>
      ${inst.principalName ? `<p style="margin: 0 0 28px;">Authorised signatory</p><p style="margin: 0; font-weight: 600; color: var(--ink);">${esc(inst.principalName)}</p>` : "<p>This is a computer-generated receipt.</p>"}
    </div>
    <div style="text-align: right;">
      ${inst.gstNumber ? `<p>GST: <span class="gst">${esc(inst.gstNumber)}</span></p>` : ""}
      <p>Generated via EduOps AI</p>
    </div>
  </div>
</div>

<div class="actions">
  <button class="btn alt" onclick="window.print()">Print / Save PDF</button>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
