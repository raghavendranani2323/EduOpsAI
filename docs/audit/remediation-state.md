# EduOps Non-Payment Remediation State

Updated: 18/06/2026

## Repository

- Branch: `audit/non-payment-remediation`
- Starting commit: `43ec904ab1d5e3919df1e229c272b25c6b34a513`
- Last completed remediation commit: `09eaea2 strengthen non-payment data integrity`

## Current Phase

Phase 4 - CRM-001 is locally complete. Parent access and communications remain.

- Last completed issue: `CRM-001`
- Next exact phase: Phase 4 - admissions, parent access, and communications
- Next exact issue: `PARENT-001`

## Completed

- Phase 1 implementation commits verified in Git.
- Existing unrelated untracked audit documents preserved.
- Phase 1 focused tests previously reported as passing.
- Protected attendance and homework API requests now return JSON `401`
  responses instead of redirecting to an HTML login page.
- Phase 1 SQL files have a documented repository convention and a static/live
  verification command.
- Stable API error envelopes support request IDs and `Retry-After`.
- Proxy-generated request IDs are propagated to request and response headers.
- Structured logging redacts credentials, tokens, signed URLs, and common PII.
- Durable Postgres rate limits cover parent OTP, invitations, imports, exports,
  push, communications, fee reminders, and homework uploads.
- Production security headers include CSP, frame protection, nosniff,
  referrer policy, permissions policy, and HSTS.
- Shared academic permission helpers enforce assigned-class access.
- Academic RLS policies now deny accountants and unassigned teachers.
- Marks entry validates student, subject, class, tenant, duplicates, and total
  marks before writing.
- A formal permission matrix and `prismaAdmin` allowlist are documented.
- Phase 3 schema risk inventory and index review are documented.
- Class academic-year relations are authoritative and legacy labels are
  database-maintained mirrors.
- Tenant-scoped admission, pending-invitation, class-section, and subject
  uniqueness rules are implemented.
- Cross-tenant relationship and timetable-overlap triggers are implemented.
- Student deletion archives records; classes with operational history cannot
  be deleted.
- Student/timetable application validation, audit events, migration prechecks,
  and seed compatibility are implemented.
- Admissions now includes overdue follow-ups, call/WhatsApp actions, quick
  notes, durable activity history, ownership, lost reasons, duplicate signals,
  safe conversion conflicts, and conversion audit history.

## Partial Or Blocked

- Live RLS and migration execution: blocked until dedicated
  `RLS_TEST_SUPERUSER_URL` and `RLS_TEST_APP_USER_URL` are configured.
- Supabase Storage policy and signed URL lifecycle: blocked without a staging
  project and role fixtures.
- Push provider delivery: blocked without staging VAPID configuration.
- Invitation email lifecycle: blocked without staging Auth/SMTP configuration.
- Phase 7 live migration, trigger transaction tests, index query plans, and
  lock timing: blocked without a restored staging database.

## Deferred

- `PAY-001`, `PAY-002`, `PAY-003`, and `PAY-004`: deferred by product
  decision, not resolved and not production-ready.
- Legal conclusions and customer willingness-to-pay validation.

## Tests Last Run

- `pnpm test:phase1`: passed.
- `pnpm test:api-foundations`: passed.
- `pnpm test:permissions`: passed.
- `pnpm test:data-integrity`: passed.
- `pnpm test:phase4-crm`: passed.
- `pnpm test:migrations`: static verification passed; live verification
  skipped because `RLS_TEST_SUPERUSER_URL` is unavailable.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 18 warnings and no errors.
- `pnpm build`: passed; 69 routes generated.
- `pnpm test:rls`: blocked by missing dedicated RLS test URLs.
- `pnpm audit --audit-level moderate`: failed with 8 advisories.
- Production smoke on port 3100:
  - anonymous attendance API: JSON `401`
  - anonymous homework upload API: JSON `401`
  - unconfigured push send API: JSON `503`
  - `/login` response included the configured security headers and request ID.
  - Browser automation could not run because the local Playwright Chromium
    executable is unavailable; HTTP and production build checks completed.

## Known Failures

- `pnpm audit --audit-level moderate` previously reported eight advisories.
- RLS tests fail closed when dedicated test database URLs are absent.

## Manual Actions

1. Provide dedicated non-production RLS test database credentials.
2. Apply and verify Phase 1-3 SQL on staging after a backup, in phase order.
3. Confirm the `homework` bucket is private.
4. Configure staging Auth redirects, SMTP, VAPID, and internal push token.

## Resume

Continue Phase 4 with `PARENT-001`, then `MSG-001`. Apply
`phase5_api_foundations.sql`, `phase6_permission_hardening.sql`, and
`phase7_non_payment_data_integrity.sql`, then `phase8_admissions_crm.sql` in
order before staging verification. Re-run live Phase 0-4 checks when staging
credentials and role fixtures are available.
