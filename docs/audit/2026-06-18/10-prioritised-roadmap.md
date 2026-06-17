# Prioritised Roadmap

## P0 Critical

| ID | Description | Evidence | User Impact | Business Impact | Recommended Fix | Dependencies | Effort | Risk | Order | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | Attendance records accept unvalidated student IDs, allowing possible cross-tenant data contamination if a foreign ID is supplied. | `app/api/attendance/route.ts`; RLS policy checks session institution but not student institution. | False attendance and possible exposure/contamination. | Cannot credibly sell multi-tenant SaaS. | Validate every submitted student belongs to `{ institutionId, classId }`; add DB-level consistency where possible; add negative RLS/API tests. | Attendance API, schema/RLS tests. | M | High | 1 | API rejects foreign tenant, wrong class, inactive, and unknown students; tests prove rejection. |

## P1 High

| ID | Description | Evidence | User Impact | Business Impact | Recommended Fix | Dependencies | Effort | Risk | Order | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-002 | Teacher can deep-link or POST attendance for classes not assigned to them. | Teacher scoping on `/attendance` list only; missing in detail/API. | Teachers can alter wrong class records. | Breaks school trust and role promise. | Add shared server authz helper for teacher class scope and apply to page/API. | SEC-001. | S | High | 2 | Teacher API/page returns 403/404 for unassigned classes; E2E covers it. |
| PAY-001 | Parent Razorpay payment is not usable while marketing claims UPI/Razorpay. | Parent pages say coming soon; landing/pricing claims payment. | Parents cannot pay online as promised. | Conversion and trust risk. | Either remove claims or complete parent payment with reconciliation. | PAY-002, PAY-003. | M | High | 3 | Parent can pay test invoice or marketing no longer claims online payment. |
| PAY-002 | Razorpay webhook lacks stored order/amount/currency reconciliation. | Webhook verifies signature but trusts notes/invoice. | Wrong invoice/payment status possible. | Financial integrity blocker. | Store orders; verify order ID, amount, currency, invoice, institution, status; record event IDs. | Payment schema. | M | High | 4 | Duplicate/wrong amount/wrong order webhooks are rejected/idempotent in tests. |
| PAY-003 | Manual payments lack idempotency and concurrency protection. | Payment route reads remaining then writes payment without lock/key. | Duplicate submit can overpay. | Fee disputes. | Add idempotency key, transaction isolation/row lock pattern, duplicate detection. | Payment API. | M | High | 5 | Concurrent payment test cannot overpay. |
| PAY-004 | Receipt generation mutates state on GET. | Receipt route assigns receipt number during GET. | Receipt numbers can race/skip. | Audit/accounting trust risk. | Move assignment to explicit transaction on payment finalisation or POST; make idempotent. | PAY-003. | S | Medium | 6 | Repeated GET never changes state; concurrent calls produce one receipt. |
| PUSH-001 | Push send route can fail open if token env is absent. | Token checked only when `PUSH_SEND_TOKEN` exists. | Arbitrary push spam in misconfigured prod. | Severe trust/security risk. | Require auth/token unconditionally; fail closed; scope sends by institution. | Env validation. | S | High | 7 | Without token/auth route returns 401; all sends are tenant scoped. |
| MSG-001 | Communications provider is console-only and marks sends as sent. | `lib/messaging/provider.ts`; send route. | Staff think messages were delivered when not. | Failed fee/admissions follow-up. | Introduce provider statuses: draft/queued/sent/delivered/failed; hide production claims until provider integrated. | Provider choice. | M | Medium | 8 | Console provider only allowed in dev; production requires configured provider. |
| AUTH-001 | Direct staff creation shares plaintext generated passwords. | `app/api/staff/direct/route.ts`. | Credential leakage through WhatsApp/screenshots/logs. | Security and trust risk. | Replace with invite/reset/OTP; crypto random if temporary password remains; force reset. | Auth flow. | M | Medium | 9 | No API response contains reusable plaintext password. |
| FILE-001 | Homework upload uses public URLs and weak content validation. | `app/api/homework/upload/route.ts`. | Unsafe files may be shared publicly. | Child data/privacy risk. | Private bucket/signed URLs, role/class checks, extension/content validation, size limits, audit. | Storage policy. | M | Medium | 10 | Upload rejects wrong role/type; URL is scoped/signed. |
| EXPORT-001 | CSV export is formula-injection vulnerable. | `lib/export/csv.ts`. | Malicious exported cell can execute formula. | Security and support risk. | Escape formula-leading cells; add tests. | Export APIs. | XS | Medium | 11 | Exports neutralise `=`, `+`, `-`, `@`, tab, CR cells. |
| PWA-001 | Offline claims exceed implementation; stale cache returns expired data. | Push-only SW; `lib/offline/db.ts` stale return. | Teachers may trust stale/unsynced data. | Retention/trust risk. | Fix cache expiry; make offline scope explicit or implement real sync/conflicts/logout cleanup. | Attendance sync. | M | High | 12 | Offline tests show save, fail, retry, conflict, logout handling. |
| AUD-001 | Sensitive actions are not consistently audit logged. | Audit table/page exist; coverage sparse. | No traceability for disputes. | Schools will distrust changes. | Log student, attendance, fee, payment, staff, export, notice/homework, communication actions. | Shared audit helper. | M | Medium | 13 | Audit log shows who/what/when for critical actions. |
| QA-001 | Lint fails. | `pnpm lint` 4 errors. | Release gate not clean. | Engineering quality risk. | Fix lint errors and warnings with agreed threshold. | None. | XS | Low | 14 | `pnpm lint` passes in CI. |
| DATA-001 | Missing/weak tenant-scoped uniqueness and indexes. | Schema/DB review. | Duplicates and slow lists. | Data cleanup/support burden. | Add constraints/indexes for admission numbers, invoice dedupe, leads, messages, homework, notices. | Migration plan. | M | Medium | 15 | Migration tests and query plans pass. |
| OPS-001 | No production health/monitoring/runbooks. | Config/repo review. | Slow incident response. | Paid launch risk. | Add health route, structured logs, error tracking, backup/restore and webhook runbooks. | Hosting choice. | M | Medium | 16 | Operator can detect, diagnose, and recover common failures. |
| TRUST-001 | Public legal/support/trust pages are missing or incomplete. | Landing review. | Buyer/parent hesitation. | Conversion blocker. | Add privacy, terms, refund/cancellation, data ownership/export, support contact. | Legal review. | M | Medium | 17 | Public footer has complete trust pages reviewed by counsel. |

## P2 Medium

| ID | Description | Evidence | Recommended Fix | Effort |
|---|---|---|---|---|
| A11Y-001 | Locale text can show Telugu while document language remains English. | Layout/browser review. | Set language dynamically or scope Telugu text with `lang="te"`. | S |
| A11Y-002 | Attendance status controls are below 44px width. | Browser measurement. | Increase tap target sizing. | XS |
| A11Y-003 | Skip link and some icon labels are missing/unclear. | Layout/page review. | Add skip link and accessible names. | S |
| SEO-001 | No robots, sitemap, structured data, OG/Twitter image found. | Public file/config review. | Add SEO basics and route indexing rules. | S |
| LP-001 | Landing page has weak ICP, proof, pricing/contact, and screenshots. | Landing review. | Reposition for coaching/tuitions with truthful claims. | M |
| API-001 | Several APIs expose raw error strings. | Route review. | Use safe error responses and server-side logs. | S |
| API-002 | Rate limiting is inconsistent. | Route review. | Add rate limits for auth, OTP, imports, reminders, sends, exports. | M |
| PARENT-001 | Parent bearer tokens are long-lived with no revocation UI. | Token route/portal review. | Add expiry, rotation, revocation, audit, and link regeneration. | M |
| COMP-001 | DPDP/privacy/children consent readiness is incomplete. | Public/support review and legal research. | Add privacy/consent/retention workflows; get legal review. | L |
| OBS-001 | No request IDs or structured support diagnostics. | Repo review. | Add request ID middleware/proxy and log correlation. | S |
| TEST-001 | No broad E2E/API/payment/offline/a11y test suite. | Package/test review. | Add high-value Playwright and API tests. | L |
| DB-001 | `Class` has both string and relational academic-year fields. | Prisma schema review. | Consolidate or enforce consistency. | M |
| CRM-001 | Admissions CRM lacks full follow-up workflow. | Browser/code review. | Add reminders, call/WhatsApp actions, duplicate detection, history. | M |
| FEES-001 | Fee reporting lacks daily collection/ageing/collector views. | Fees review. | Add core accountant reports. | M |
| UX-001 | Large-list mobile behaviour is unproven. | Browser sample only small data. | Seed thousands of students/invoices and test. | S |
| DEP-001 | Dependency audit reports vulnerabilities. | `pnpm audit`. | Upgrade/triage production impact. | S |

## P3 Low

| ID | Description | Recommended Fix | Effort |
|---|---|---|---|
| UI-001 | Duplicate class names in fee filter can confuse users. | Include section/group consistently. | XS |
| UI-002 | Empty states need clearer next actions and support links. | Add role-aware CTAs. | S |
| DOC-001 | Add architecture docs for RLS, `withRls`, and `prismaAdmin` allowlist. | Write security architecture note. | S |
| PERF-001 | Add route-level bundle/performance budgets. | CI budget and Lighthouse. | M |
| SEO-002 | Add local/segment content later. | Coaching/tuitions pages after positioning validation. | M |
| SUPPORT-001 | Add contextual help for import/fees/attendance. | Help snippets and docs. | M |
| OPS-002 | Add status page after first pilots. | Simple hosted status page. | S |

## Not Recommended Now

| ID | Item | Reason |
|---|---|---|
| NR-001 | Transport/library/hostel/payroll before first ICP fit | Increases implementation burden and competes with mature ERPs too early. |
| NR-002 | Generic AI branding/features | No clear daily workflow evidence yet. |
| NR-003 | Native apps before PWA/mobile web is trusted | Diverts effort from reliability, payments, and security. |
| NR-004 | Custom roles/branch/franchise platform now | Needed later for chains, not first coaching/tuitions ICP. |
| NR-005 | Heavy dashboard analytics before core workflows | Schools pay first for accurate daily operations. |

## Requires Customer Validation

| ID | Question |
|---|---|
| CV-001 | Will coaching centres pay Rs 1,499-2,999/month for fee follow-up, attendance, and WhatsApp workflows? |
| CV-002 | Is online Razorpay payment or manual UPI/cash tracking more important for first customers? |
| CV-003 | Do parents prefer token links, OTP login, or WhatsApp-only updates? |
| CV-004 | Which reports are must-have for accountants in the first 30 days? |
| CV-005 | Is Telugu localisation required for buyers, staff, parents, or all three? |
