# API, Security, And Tenancy Audit

Evidence sources: App Router API inventory, static review of route handlers, Prisma schema and RLS policies, local DB policy/index inspection, `pnpm test:rls`, and non-destructive browser/runtime probes.

## RLS And Tenant Isolation Baseline

Confirmed from database policy inspection:

- RLS is enabled on core tenant tables including `students`, `classes`, `class_groups`, `academic_years`, `attendance_sessions`, `attendance_records`, `guardians`, `student_guardians`, `fee_plans`, `fee_plan_components`, `invoices`, `payments`, `leads`, `messages`, `message_templates`, `homework`, `notices`, `notice_reads`, `exams`, `exam_results`, `subjects`, `timetable_slots`, `push_subscriptions`, `audit_logs`, `memberships`, `profiles`, and `institutions`.
- Existing RLS test passed. It created two test institutions and confirmed a user from tenant A could not see tenant B students/classes/invoices/notices/fee plans through the tested paths.

Critical limitation:

- Existing RLS tests do not cover every table, every API route, parent tokens, invitation tokens, exports, attendance record student validation, webhooks, file uploads, or teacher/accountant role constraints.

## API Inventory And Findings

| API / Group | Auth | Authz / Role | Tenant Scoping | Validation | Rate Limit | Findings | Severity |
|---|---|---|---|---|---|---|---|
| `/api/onboarding` | User/session expected | Owner/admin implied | Institution creation/join flow | Partial | Not confirmed | Needs spam/duplicate/multiple-membership tests. | P2 |
| `/auth/callback` | Supabase callback | Callback flow | Depends on cookies/redirect | Partial | Supabase | Needs open redirect and callback URL validation review. | P2 |
| `/api/academic-years/*` | `requireInstitution()` | Owner/admin likely | Uses institution | Zod in routes | Not confirmed | Better audited than many modules; logs some actions. Needs rollover/promotion coverage. | P2 |
| `/api/classes/*` | `requireInstitution()` | Mixed | Generally institution scoped | Partial | Not confirmed | Need teacher/accountant direct API rejection tests and duplicate class/section constraints. | P2 |
| `/api/students/*` | `requireInstitution()` | Mixed | Generally institution scoped | Partial | Not confirmed | Student create/update/delete/import need audit logs, duplicate admission/guardian handling, import abuse limits. | P2 |
| `/api/students/[id]/portal-token` | `requireInstitution()` | Admin/owner expected | Student scoped before token | Partial | Not confirmed | Generates persistent bearer token with no expiry/rotation/revocation UI. Entropy is good, lifecycle is weak. | P1 |
| `/api/attendance` | `requireInstitution()` | Missing teacher class check | Session scoped to institution | Zod shape only | Not confirmed | Accepts arbitrary class and `studentId` records; no assigned-class or class-membership validation. | P0/P1 |
| `/api/fees/plans/*` | `requireInstitution()` | Owner/admin/accountant expected | Institution scoped | Partial | Not confirmed | Needs component constraints, duplicate plan checks, and teacher direct API rejection tests. | P2 |
| `/api/fees/generate` | `requireInstitution()` | Owner/admin/accountant expected | Institution scoped | Partial | Not confirmed | Bulk generation needs idempotency, duplicate invoice prevention, transaction and partial failure handling. | P1 |
| `/api/fees/invoices/[id]/payments` | `requireInstitution()` | Owner/admin/accountant expected | Invoice scoped | Zod | Not confirmed | Manual payment race can overpay; no idempotency key or row lock. | P1 |
| `/api/fees/invoices/[id]/receipt` | `requireInstitution()` | Fee roles expected | Invoice scoped | N/A | N/A | GET mutates receipt number state via service-role admin update outside full transaction. | P1 |
| `/api/razorpay/create-order` | `requireInstitution()` | Fee roles expected | Invoice scoped | Partial | Not confirmed | Order persistence/reconciliation model not evident. Parent-facing pay is not complete. | P1 |
| `/api/razorpay/verify` | `requireInstitution()` | Fee roles expected | Invoice scoped | Partial | Not confirmed | Needs duplicate, failed/cancelled, amount/currency/order reconciliation tests. | P1 |
| `/api/razorpay/webhook` | Signature required | External webhook | Invoice found by ID | Signature only | Razorpay retry | Verifies signature, but lacks stored order reconciliation, amount/currency checks, event replay record, and overpayment guard. | P1 |
| `/api/fees/reminders` | `requireInstitution()` | Fee roles expected | Institution scoped | Partial | Not confirmed | Creates queued reminder rows/WhatsApp links, not provider-integrated delivery. Duplicate send protection unclear. | P2 |
| `/api/admissions/*` | `requireInstitution()` | Mixed | Institution scoped | Partial | Not confirmed | Needs duplicate lead, ownership, conversion integrity, audit, and follow-up reminder tests. | P2 |
| `/api/communications/send` | `requireInstitution()` | Mixed | Institution scoped | Partial | Not confirmed | Uses `ConsoleProvider`; can mark as sent without delivery and logs PII. | P1 |
| `/api/homework/*` | `requireInstitution()` | Teacher/admin expected | Institution/class scoped in parts | Partial | Not confirmed | Upload route uses service role and public URL with broad member access and MIME-only validation. | P1 |
| `/api/notices/*` | `requireInstitution()` | Teacher/admin expected | Institution/audience scoped | Partial | Not confirmed | Need audience tests, parent scoping, read tracking, push integration, and audit. | P2 |
| `/api/exams/*` | `requireInstitution()` | Teacher/admin expected | Institution/class scoped | Partial | Not confirmed | Needs mark-entry validation, teacher scope, publish/correction, and parent visibility tests. | P2 |
| `/api/subjects/*` | `requireInstitution()` | Admin expected | Institution scoped | Partial | Not confirmed | Needs teacher assignment consistency and uniqueness tests. | P2 |
| `/api/timetable/*` | `requireInstitution()` | Admin/teacher expected | Institution scoped | Partial | Not confirmed | Needs clash detection, teacher scope, academic-year/archive tests. | P2 |
| `/api/staff/*` | `requireInstitution()` | Owner/admin | Institution scoped | Partial | Audit count rate limit | Direct staff creation returns plaintext generated password and WhatsApp credential share. | P1 |
| `/api/invitations/*` | `requireInstitution()` for create | Owner/admin | Institution scoped | Partial | Not confirmed | Needs expired/reused token, cross-tenant acceptance, and audit tests. | P2 |
| `/api/parent/otp` | Public | Parent phone | Cross-institution by verified phone | Supabase phone OTP | Supabase only | Needs app-level rate limits, enumeration-safe messages, consent, and abuse monitoring. | P2 |
| `/api/parent/*` | Parent session/token | Parent phone/token | Guardian/student scoped | Partial | Not confirmed | Needs multi-child, same-phone, changed-phone, and revoked access tests. | P2 |
| `/api/push/subscribe` | Optional user | None for anonymous | User nullable | Partial | Not confirmed | Stores anonymous subscriptions; no tenant/user cleanup verified. | P1 |
| `/api/push/send` | Shared token only if configured | None otherwise | `userId` optional, defaults all | Partial | Not confirmed | If `PUSH_SEND_TOKEN` is unset, arbitrary callers can send pushes to up to 500 subscriptions. | P1 |
| `/api/export/*` | `requireInstitution()` | Role-dependent | Institution scoped | Partial | Not confirmed | CSV formula injection risk; export authorization needs full role and tenant tests. | P1 |
| `/api/audit-log` | `requireInstitution()` | Admin/owner expected | Institution scoped | Partial | Not confirmed | Audit logs exist but coverage is sparse. | P1 |
| `/api/locale` | Cookie/session | N/A | Cookie scoped | Partial | N/A | Telugu switching works visually, but document `lang` remains `en`. | P2 |

## Highest-Risk Security Findings

### SEC-001 - Attendance API can create cross-tenant data contamination

Type: Confirmed design defect, possible P0 exploit if a foreign student ID is known.

Evidence:

- `app/api/attendance/route.ts` creates attendance records from submitted `records[].studentId` after upserting the session.
- The route validates payload shape but does not verify each student belongs to the requested class and institution.
- `attendance_records` RLS checks the session's institution, not the referenced student's institution.
- `AttendanceRecord` has no `institutionId`, so DB/RLS cannot cheaply enforce same-tenant student/session ownership.

Expected behaviour:

- A class attendance save should only accept active students enrolled in that class, in the same institution, for the selected academic year.

Actual behaviour:

- The API trusts caller-submitted student IDs.

Impact:

- Data integrity risk, possible cross-tenant contamination, false attendance records, and loss of institutional trust.

Recommended fix:

- In the API, fetch allowed active students for `{ institutionId, classId }` and reject any submitted ID outside the set.
- Enforce teacher assigned-class scope before accepting attendance.
- Consider adding `institutionId` to `AttendanceRecord` plus DB triggers or composite constraints so RLS can enforce consistency.
- Add RLS/API tests that submit a foreign tenant student ID and expect rejection.

### SEC-002 - Teacher attendance scope is only partially enforced

Evidence:

- `app/(app)/attendance/page.tsx` scopes teacher class cards through `getTeacherClassIds`.
- `app/(app)/attendance/[classId]/page.tsx` fetches any class by `{ id, institutionId }` without teacher assignment check.
- `app/api/attendance/route.ts` does not check teacher class assignment.

Impact:

- A teacher can deep-link or directly POST attendance for another class in the same institution.

Severity: P1 because it breaks role promises and attendance integrity. It becomes P0 if combined with foreign student ID contamination.

### SEC-003 - Push send endpoint is unsafe when token is absent

Evidence:

- `app/api/push/send/route.ts` only validates `Authorization: Bearer ...` if `process.env.PUSH_SEND_TOKEN` exists.
- If `PUSH_SEND_TOKEN` is not configured, the route proceeds.
- If no `userId` is supplied, it selects up to 500 push subscriptions.

Impact:

- In a misconfigured production environment, anonymous callers could send arbitrary push notifications to subscribed devices.

Recommended fix:

- Require authenticated admin/server job identity or a mandatory token. Fail closed when unset.
- Scope sends by institution, purpose, and recipient set.

### SEC-004 - CSV exports are vulnerable to formula injection

Evidence:

- `lib/export/csv.ts` quotes commas/quotes/newlines but does not escape cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return.

Impact:

- Malicious student/guardian/imported text can execute formulas when an exported CSV is opened in Excel/Sheets.

Recommended fix:

- Prefix dangerous cell values with apostrophe or tab-safe escape and test exports with malicious input.

### SEC-005 - Staff direct creation shares plaintext passwords

Evidence:

- `app/api/staff/direct/route.ts` uses `Math.random()` to generate passwords.
- The response and WhatsApp share include the generated password.

Impact:

- Weak credential generation and credential exposure to administrators, chat history, logs, and screenshots.

Recommended fix:

- Prefer invite links, password reset, or OTP. If temporary passwords are unavoidable, use crypto random, force reset, and never expose after first display.

## `prismaAdmin` Findings

Patterns observed:

- `prismaAdmin` is used for trusted flows such as Supabase auth support, parent token portal, receipts, webhooks, file upload, and cross-session operations.
- Many uses are institution-scoped before admin mutation, which is good.

Risks:

- Admin use bypasses RLS and must be paired with explicit institution and permission checks.
- Receipt generation uses admin updates in a GET flow.
- Parent portal uses token lookup through admin access, so token lifecycle becomes the security boundary.
- Homework upload uses admin storage access and produces public URLs.

Required control:

- Maintain an allowlist of `prismaAdmin` files with documented reason, required precondition, tenant-scope check, and tests.

## Security Headers

No central security headers were found in `next.config.ts` or proxy:

- Content-Security-Policy
- `frame-ancestors` / X-Frame-Options
- Referrer-Policy
- Permissions-Policy
- X-Content-Type-Options

This is P2 for launch because the app handles children, payments, parent links, and PII.

## Dependency Audit

`pnpm audit --audit-level moderate` failed with 8 vulnerabilities:

- 1 high
- 6 moderate
- 1 low

Notable advisories included `hono` and `@hono/node-server` issues through Prisma dev dependencies, and a PostCSS advisory through Next.js 16.2.7. These should be triaged before launch, with production dependency exposure distinguished from dev-only exposure.
