# Product Completeness And Feature-Gap Analysis

## Selected Segment Assumption

Recommended first target: owner-led coaching centres and tuition centres with 100-800 students, 3-25 staff, mixed cash/UPI collections, WhatsApp-heavy parent communication, and current dependence on registers/spreadsheets.

This analysis avoids recommending every possible ERP feature. The goal is to reach a focused product that a first segment will pay for and adopt.

## Required Before First Paying Customer

| Gap | Why It Matters | Evidence | Priority |
|---|---|---|---|
| Server-side teacher attendance scope | Teachers must not alter another class. | List page scopes teachers; detail/API do not. | P1 |
| Attendance student validation | Prevent false or cross-tenant records. | API trusts submitted `studentId`s. | P0 |
| Payment integrity | Schools will not tolerate incorrect fee balances. | Manual payment race, weak webhook reconciliation, receipt GET side effects. | P1 |
| Truthful parent payment | Landing/pricing claims UPI/Razorpay; parent portal says coming soon. | Parent pages and landing copy conflict. | P1 |
| CSV export safety | Schools export to Excel; malicious text can become formulas. | `lib/export/csv.ts` does not neutralise formula cells. | P1 |
| Real communication provider status | Fee reminders and notices must not falsely show sent. | `ConsoleProvider` always succeeds. | P1 |
| Audit logging for sensitive actions | Fee, attendance, student, staff, and communication changes need traceability. | Audit table exists but coverage is sparse. | P1 |
| Basic operational monitoring | Paid schools expect quick support and recovery. | No health/error tracking/runbooks found. | P1 |
| Privacy/terms/support pages | Schools and parents need trust before data/payment use. | No complete public trust/support surface found. | P1 |
| Lint/build/release gate | Releases should not ship with failing lint. | `pnpm lint` failed. | P1 |

## Required For The Selected Target Segment

| Feature | Current State | Needed Scope |
|---|---|---|
| Student import templates | Import route exists. | Downloadable template, validation preview, duplicate handling, rollback, help copy. |
| Fast student search | Student list exists. | Instant search, class filters, guardian phone search, long-name support. |
| Attendance reports | Marking exists. | Daily/monthly summary, absent list, export, parent visibility, WhatsApp absent alert. |
| Fee ageing | Fees module exists. | Outstanding by month, ageing buckets, class-wise due list, collector notes. |
| Daily collection summary | Not complete. | Cash/UPI/Razorpay mode split, collector tracking, receipt list. |
| WhatsApp reminders | Links/records partial. | Template variables, preview, duplicate protection, opt-out/consent, delivery status when provider integrated. |
| Admissions follow-up | Kanban exists. | Follow-up dates, call/WhatsApp actions, duplicate lead checks, conversion history, lost reason. |
| Parent portal | Exists. | Revocable access, payment, multiple children, readable privacy/support language. |
| Staff invite/onboarding | Exists. | Avoid plaintext passwords; use invite/OTP/reset. |
| Guided onboarding | Checklist exists. | Task-based activation: create class, import students, mark attendance, create fee plan, generate dues, send reminder. |

## Required After Early Traction

- Academic-year rollover and student promotion.
- Student transfer between batches/classes.
- Report cards and custom grading for school segment.
- Scheduled messages.
- Parent app/PWA install prompts after portal trust is proven.
- Advanced analytics.
- Custom fields.
- Support tickets.
- Data migration tooling.
- Branch/franchise support.
- Bulk certificates/ID cards if customer interviews show pull.
- Refunds, credit balance, concessions, scholarships.
- GST/tax support if institution billing/use cases require it.

## Enterprise-Only Or Later

- Transport.
- Library.
- Hostel.
- Inventory.
- Payroll.
- Biometric attendance.
- Advanced approval workflows.
- Custom roles.
- Multi-campus/franchise controls.
- ERP-level board compliance/reporting.

These can differentiate for large schools later but would slow the recommended coaching/tuitions wedge.

## Not Recommended Now

- Generic "AI" features without a concrete daily workflow.
- Decorative dashboards before fee/attendance reliability.
- A full native mobile app before the PWA/mobile web flow is trusted.
- Broad ERP modules that increase onboarding/support burden before product-market fit.
- Complex customisation frameworks before 10-20 paying customers validate repeated needs.

## Incomplete Or Misleading Current Functionality

| Area | Incomplete/Misleading Element | Recommendation |
|---|---|---|
| Landing page | Claims UPI/Razorpay and offline attendance beyond current parent/offline readiness. | Rewrite claims until complete or label as internal/beta. |
| Communications | Console provider marks sends as successful. | Separate draft/queued/sent/delivered/failed. |
| Parent payments | Parent pages say coming soon. | Hide payment claims or complete flow. |
| Offline | Push-only service worker and limited queue. | Market as "pending sync while app is open" only after UX is explicit, or build real offline. |
| Staff onboarding | Plaintext password share. | Replace with invite/reset/OTP. |
| Audit logs | Page exists but many critical actions are not logged. | Expand audit coverage before launch. |
