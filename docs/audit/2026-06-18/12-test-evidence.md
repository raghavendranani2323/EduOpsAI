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
