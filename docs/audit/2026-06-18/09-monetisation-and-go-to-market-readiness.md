# Monetisation And Go-To-Market Readiness

## Current Readiness

EduOps AI does not yet have the systems needed to sell and operate SaaS subscriptions at production quality.

Not found or incomplete:

- Institution subscription model.
- Trial status and trial expiry.
- Plan limits.
- Student/staff/branch usage metering.
- Feature gating.
- EduOps customer billing through Razorpay or another provider.
- Upgrade/downgrade/cancellation.
- Failed-payment grace period.
- Renewal reminders.
- Institution invoice/receipt generation.
- Data export on exit.
- Retention/deletion after cancellation.
- Internal super-admin/customer-success tooling.

## Pricing Hypothesis

For the recommended coaching/tuitions ICP:

| Plan | Target | Suggested Price | Included |
|---|---|---:|---|
| Starter | Small tuition/coaching centre up to 200 students | Rs 999-1,499/month | Students, classes/batches, attendance, fees, basic reminders, homework/notices, parent links, exports. |
| Growth | 200-600 students | Rs 1,999-2,999/month | Starter plus admissions CRM, advanced fee reports, more staff, priority support, bulk imports. |
| Pro | 600-1,500 students or multi-batch centres | Rs 4,999/month | Growth plus provider-integrated messaging, advanced analytics, custom templates, API/export support. |

Annual discount: 15-20 percent.
Assisted setup/import: Rs 3,000-10,000 one time, depending data quality.
Pilot strategy: 30-day founder-assisted pilot with strict limits and written beta caveats.

These are assumptions, not validated pricing. Interview and pilot evidence is required.

## Trial Strategy

Recommended:

- 14-day guided trial or 30-day assisted pilot for the first cohort.
- Trial should include sample data and an onboarding checklist.
- Require real setup milestones before calling a trial activated.
- Do not rely only on self-serve signup at this stage.

Activation target:

- First fee plan, first invoice batch, first attendance save, and first WhatsApp reminder within 48 hours of onboarding.

## Sales Motion

Recommended first motion:

- Founder-led outbound to local coaching/tuitions.
- Demo on a phone, not a desktop-only demo.
- Offer spreadsheet import help.
- Sell one operational promise: fee visibility and follow-up plus attendance.
- Use WhatsApp support as a trust channel.

Avoid:

- Long enterprise school RFPs.
- Custom feature commitments.
- Broad "complete ERP" promises.
- Selling online payments before reconciliation and parent flow are reliable.

## Support Requirements Before Charging

Minimum:

- Public support email and WhatsApp number.
- Help page for import, attendance, fees, and parent links.
- Privacy policy, terms, refund/cancellation policy, data ownership/export statement.
- Error reference IDs or request IDs for support.
- Admin runbook for failed payments, duplicate payments, failed imports, and attendance sync.
- Backup/restore commitment stated accurately.
- Support access policy: when and how EduOps staff can access institution data.

## Product Changes Needed Before Charging

1. Close P0/P1 security and financial findings.
2. Add institution subscription/trial state.
3. Add plan limits and usage display.
4. Add billing/invoice handling for EduOps customers.
5. Add cancellation and data-export process.
6. Add customer support/trust pages.
7. Add observability and incident response.
8. Add founder/admin support tooling without unsafe impersonation.

## Willingness-To-Pay Argument

Strongest argument:

"If EduOps helps a centre recover even a few delayed monthly fees and saves the owner/accountant several hours per week, Rs 1,500-3,000/month is rational."

The product must prove this through:

- Accurate outstanding list.
- Fast reminders.
- Correct receipts.
- Daily collection summary.
- Parent-facing clarity.
- Reliable attendance and follow-up records.
