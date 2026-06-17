# Test Evidence And Limitations

## Baseline

- Repository path confirmed: `C:\Users\user\Desktop\EduOps`
- Branch: `master`
- Commit: `f4c14b65df46f34a642317998d188bc5a04464fe`
- Commit summary: `Teacher-focused experience: role-aware navigation + financial/admin lockdown`
- Initial worktree: clean except branch tracking display `## master...origin/main`

## Commands Executed

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
git status --short --branch
rg --files
pnpm lint
pnpm typecheck
pnpm build
pnpm test:rls
pnpm audit --audit-level moderate
pnpm.cmd start
```

Additional read/inspection commands were run with `Get-Content`, `rg`, DB policy/index inspection through the local Node/Postgres environment, and browser automation through the in-app browser.

No secret values from `.env`, `.env.local`, database URLs, Supabase keys, Razorpay keys, VAPID private keys, or service-role credentials were displayed or copied.

## Successful Checks

- `pnpm typecheck` passed.
- `pnpm build` passed on Next.js 16.2.7.
- `pnpm test:rls` passed existing tenant isolation tests.
- Production server started locally at `http://localhost:3000`.
- Sampled authenticated routes rendered without browser console errors.
- Sampled mobile/desktop viewports did not show horizontal overflow.
- Invalid parent token route returned 404.
- Razorpay webhook route returned 405 for unsupported method in direct probe.

## Failed Checks

### `pnpm lint`

Failed with four errors and 18 warnings.

Errors:

- `app/(app)/settings/academic-year/academic-year-client.tsx:283`: internal raw `<a>` to `/classes/`.
- `app/(app)/settings/academic-year/academic-year-client.tsx:287`: internal raw `<a>` to `/students/new/`.
- `app/parent/page.tsx:132`: `react/no-children-prop`.
- `components/shell/offline-indicator.tsx:15`: `react-hooks/set-state-in-effect`.

Warning themes:

- Unused variables.
- React Compiler incompatible-library warnings around React Hook Form `watch`.
- Other lint warnings requiring cleanup before release.

### `pnpm audit --audit-level moderate`

Failed with 8 vulnerabilities:

- 1 high.
- 6 moderate.
- 1 low.

Notable advisory areas included `hono`, `@hono/node-server`, and PostCSS through dependency chains. Production exposure needs triage.

## Browser Scenarios

Authenticated owner session for `Phase One Public School`:

- `/dashboard`: tested at 320x568, 360x640, 375x667, 390x844, 412x915, 768x1024, 1280x720, 1440x900.
- `/fees`: rendered KPIs, filters, no invoices for June 2026.
- `/students`: rendered four students.
- `/classes`: rendered Class 6 with two sections.
- `/attendance`: rendered two pending class cards for 18/06/2026.
- `/attendance/[classId]`: rendered mobile marking UI with two students.
- `/settings/team`: rendered add teacher form and team count.
- `/admissions`: rendered empty Kanban.
- `/communications`: rendered empty templates state.
- `/homework`, `/notices`, `/exams`, `/timetable`: rendered empty states.

Observed browser console:

- No console errors in sampled routes.

Observed layout:

- No horizontal overflow in sampled routes.
- Attendance direct status buttons were about 40px wide at 360x640.

## Role Tests

Confirmed by code:

- Teacher class list is scoped in `/attendance`.
- Teacher class detail/API scope is missing for attendance.
- Navigation hides financial/admin areas for teachers according to recent commit intent, but server-side route/API enforcement must be expanded and tested.

Not completed:

- Separate live teacher, accountant, parent, anonymous, and multi-tenant browser sessions.
- Full permission matrix execution by role.

## Tenancy Tests

Completed:

- Existing `pnpm test:rls` passed for seeded tenant A/B visibility on selected resources.
- DB inspection confirmed RLS is enabled on major tenant tables.

Not completed:

- Cross-tenant direct API fuzzing for every route.
- Parent-token cross-tenant tests.
- Invitation-token cross-tenant tests.
- Export endpoint cross-tenant tests.
- Razorpay webhook malicious note/order tests.
- Foreign-student attendance record exploit test against DB, because this was a non-destructive audit and should be added as a controlled automated test.

## API Tests

Static review completed for major API groups:

- Attendance.
- Fees/invoices/payments/receipts.
- Razorpay create/verify/webhook.
- Fee reminders.
- Communications.
- Parent OTP/children.
- Staff direct/reset/invitations.
- Homework upload.
- Push subscribe/send.
- Exports.
- Academic years.

Direct unauthenticated HTTP probes were attempted. PowerShell did not reliably expose redirect status for protected routes because `.Exception.Response` was null on several redirects/errors. Reliable probe results included:

- `/api/razorpay/webhook` with unsupported method returned 405.
- `/p/not-a-valid-token` returned 404.

## PWA/Offline Tests

Completed:

- Static review of `public/manifest.json`, `public/sw.js`, `public/offline.html`, service worker registration, and IndexedDB helper.

Not completed:

- Full offline browser simulation.
- Network interruption during attendance save.
- Reconnection after another user changes records.
- Logout while mutations are pending.
- Shared-device cache leakage test.

Reason:

- The code review already established that the service worker does not intercept fetch and sync is app-level, so deeper offline simulation should follow fixes or a dedicated offline test harness.

## Competitor And Regulatory Research

Competitor research used first-party, app-store, and review-marketplace sources listed in `07-competitor-research.md`.

Regulatory context researched:

- DPDP Act/Rules status through Indian government and legal analysis sources.
- Children data consent themes.
- CERT-In incident/logging expectations.
- Razorpay payment aggregator/compliance context.

Legal conclusions were not made. Compliance items are recommendations requiring qualified legal review.

## Limitations

- No production deployment URL was available.
- No real Supabase/Razorpay/WhatsApp provider production account testing was performed.
- No external account attack testing was performed.
- No destructive tests were run.
- No source secrets were displayed.
- No broad seeded large-data performance test was run.
- No Lighthouse/Core Web Vitals run was completed.
- No separate role accounts were used in the browser.
- No Playwright/axe automated accessibility suite was present.
- No payment sandbox E2E was completed.
- No full offline/reconnection simulation was completed.

## Phase 1 Security And Integrity Implementation - 2026-06-18

### Commands

| Command | Result |
|---|---|
| `pnpm test:phase1` | Passed. Attendance validation/replacement, teacher class access, push fail-closed validation, CSV neutralisation, staff plaintext checks, and homework file checks passed. |
| `pnpm typecheck` | Passed with no TypeScript errors. |
| `pnpm lint` | Passed with 0 errors and 18 warnings. The four previously documented lint errors were fixed. |
| `pnpm build` | Passed. Next.js 16.2.7 production build compiled and generated 69 static pages. |
| `pnpm test:rls` | Not executed against a database. The harness now fails safely because `RLS_TEST_SUPERUSER_URL` and `RLS_TEST_APP_USER_URL` are not configured. Embedded credential fallbacks were removed. |
| `pnpm audit --audit-level moderate` | Failed: 8 advisories (1 high, 6 moderate, 1 low), including transitive Hono/@hono/node-server issues through Prisma dev tooling and PostCSS through Next.js. |
| `git diff --check` | Passed after removing one trailing blank line; line-ending conversion warnings remain informational on Windows. |
| Production API smoke test | `/api/push/send` without configured token returned 503; anonymous attendance and homework upload requests returned 307 to login. |

### Focused Scenarios

- Valid attendance student in the selected class succeeds.
- Unknown, wrong-class, foreign-tenant, inactive, and duplicate attendance student IDs are rejected.
- Attendance validation failure occurs before replacement deletion.
- Owner and assigned teacher class access succeeds; unassigned teacher, accountant, and wrong-tenant class access fail.
- Push sending fails closed without configuration or credentials and rejects payloads without explicit recipients.
- CSV values beginning with formula-control prefixes are neutralised while normal quoting remains intact.
- Direct staff onboarding contains no password creation/update or plaintext password response path.
- Invitation acceptance uses an atomic single-use update and does not disclose the invited email on account mismatch.
- Homework validation accepts signed JPEG/PNG/WebP/PDF formats only and rejects disallowed, mismatched, and fake WebP content.

### Unavailable Verification

- Live owner/admin, assigned-teacher, unassigned-teacher, accountant, tenant-A, and tenant-B browser/API sessions were not available.
- Database RLS migration execution and rollback were not performed.
- Supabase private-bucket policy, signed URL expiry, and cross-tenant object access were not tested against a live project.
- A push provider send was not performed.

## Phase 0 Remediation Verification - 18/06/2026

| Command | Result |
|---|---|
| `pnpm test:phase1` | Passed. |
| `pnpm test:migrations` | Static SQL verification passed. Live policy/column verification skipped because `RLS_TEST_SUPERUSER_URL` is not configured. |
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed with 0 errors and 18 existing warnings. |
| `pnpm build` | Passed; Next.js 16.2.7 generated 69 routes. |
| `pnpm test:rls` | Blocked as designed because dedicated test database URLs are not configured. |
| `pnpm audit --audit-level moderate` | Failed with 8 advisories: 1 high, 6 moderate, 1 low. |

Production-mode HTTP probes on local port 3100:

- Anonymous `GET /api/attendance`: JSON `401 AUTH_REQUIRED`.
- Anonymous `POST /api/homework/upload`: JSON `401 AUTH_REQUIRED`.
- Unconfigured `POST /api/push/send`: JSON `503 PUSH_SEND_NOT_CONFIGURED`.

Migration conclusion:

- The repository uses manually applied phase SQL files, not Prisma migration
  history. `prisma migrate deploy` does not discover the current files.
- Converting historical files directly into Prisma migration directories is
  unsafe without first baselining the populated database.
- `prisma/migrations/README.md` now documents the convention and staged
  verification requirement. `pnpm test:migrations` validates Phase 1 SQL
  statically and checks live columns, policies, and RLS when a dedicated
  database URL is supplied.

## Phase 1 Shared API Foundations - 18/06/2026

Implemented and locally verified:

- Stable safe error envelopes with machine code, safe message, request ID, and
  `Retry-After` support.
- Request IDs propagated through Proxy request/response headers.
- Structured JSON logs with secret and common PII redaction.
- Postgres-backed rate limits for parent OTP, staff invitations, imports,
  exports, push, communication sends, fee reminders, and homework uploads.
- Security headers: CSP, frame protection, nosniff, referrer policy,
  permissions policy, and production HSTS.
- Safe provider errors for parent OTP and communication/reminder routes touched
  in this phase.

Validation:

| Command | Result |
|---|---|
| `pnpm test:api-foundations` | Passed. |
| `pnpm test:phase1` | Passed after foundation changes. |
| `pnpm test:migrations` | Static verification passed; live verification blocked by missing dedicated database URL. |
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed with 0 errors and 18 existing warnings. |
| `pnpm build` | Passed; 69 routes generated. |

Production HTTP verification confirmed `/login` returned all configured
security headers plus `x-request-id`. Browser automation was unavailable
because the local Playwright Chromium binary is not installed. No browser
binary was downloaded during this remediation.

Manual action: apply `prisma/migrations/phase5_api_foundations.sql` to staging
before testing rate-limited endpoints.

## Phase 2 Permission Matrix - 18/06/2026

Implemented:

- Shared role and class-resource authorization helpers.
- Assigned-teacher scoping for class, subject, exam, timetable, attendance,
  homework, notice, student-detail, and marks workflows.
- Accountant denial for academic/admin APIs while preserving fee workflow
  access.
- Owner/admin-only mutations for classes, students, subjects, exams,
  timetable, and admissions.
- Teacher notices limited to the teacher's own assigned-class notices.
- Marks-entry validation for tenant/class student scope, subject scope,
  duplicate pairs, inactive students, and total marks.
- RLS backstop through `can_access_class` and hardened policies.
- Formal permission matrix and `prismaAdmin` allowlist.

Validation:

| Command | Result |
|---|---|
| `pnpm test:permissions` | Passed. |
| `pnpm test:phase1` | Passed. |
| `pnpm test:api-foundations` | Passed. |
| `pnpm test:migrations` | Static verification passed; live database check blocked. |
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed with 0 errors and 18 existing warnings. |
| `pnpm build` | Passed; 69 routes generated. |

Live role/tenant API and RLS testing remains blocked without distinct staging
identities and dedicated database URLs. Apply
`prisma/migrations/phase6_permission_hardening.sql` after the earlier security
migrations before running those tests.

## Phase 3 Non-Payment Data Integrity - 18/06/2026

Implemented normalized tenant admission uniqueness, pending-invitation
uniqueness, class-section and subject identity rules, academic-year relation
backfill/mirroring, cross-tenant relationship triggers, timetable overlap
protection, operational indexes, archival student deletion, application-level
validation, and seed compatibility.

Validation:

| Command | Result |
|---|---|
| `pnpm test:data-integrity` | Passed after wrapping asynchronous assertions for the repository's CommonJS test output. |
| `pnpm test:migrations` | Static verification passed; live Phase 7 object verification blocked by missing dedicated database URL. |
| `pnpm typecheck` | Passed. |
| `pnpm test:permissions` | Passed during checkpoint recovery. |
| `pnpm test:phase1` | Passed. |
| `pnpm test:api-foundations` | Passed. |
| `pnpm lint` | Passed with 18 existing warnings and no errors. |
| `pnpm build` | Passed; Next.js 16.2.7 generated 69 static pages. |
| `pnpm audit --audit-level moderate` | Failed with the existing 8 advisories: 1 high, 6 moderate, 1 low. |
| `pnpm test:rls` | Blocked because dedicated test URLs are not configured. |

Live migration execution, trigger/RLS transactions, query plans, lock timing,
and realistic database index sizes remain blocked until a restored staging
database and dedicated RLS URLs are available.

## Phase 4 CRM-001 - 18/06/2026

| Command | Result |
|---|---|
| `pnpm test:phase4-crm` | Passed duplicate, owner, migration, history, lost-reason, mobile action, and conversion static/unit checks. |
| `pnpm test:migrations` | Static verification passed; live CRM migration/RLS checks blocked. |
| `pnpm test:permissions` | Passed. |
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed with 18 existing warnings and no errors. |

Live role sessions, activity RLS, and database-trigger execution remain blocked
without staging identities and dedicated database credentials.

## Phase 4 PARENT-001 - 18/06/2026

| Command | Result |
|---|---|
| `pnpm test:phase4-parent` | Passed expiry, rotation, revocation, active-token, phone-variant, OTP, UI, and migration checks. |
| `pnpm test:migrations` | Static verification passed; live parent-access migration/RLS checks blocked. |
| `pnpm typecheck` | Passed after regenerating Prisma Client. |
| `pnpm lint` | Passed with 17 existing warnings and no errors. |

Live Supabase OTP delivery, distinct parent identities, access-event RLS, and
token expiry against a staging clock remain blocked by external configuration.
