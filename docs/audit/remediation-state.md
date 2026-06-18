# EduOps Non-Payment Remediation State

Updated: 18/06/2026

## Repository

- Branch: `audit/non-payment-remediation`
- Starting commit: `43ec904ab1d5e3919df1e229c272b25c6b34a513`
- Last completed remediation commit before this worktree:
  `b1ce38a secure parent access lifecycle`
- Current remediation remains uncommitted and preserves the existing worktree.

## Current Phase

The remaining non-payment remediation is implemented and locally verified.
No payment integration or `PAY-001` through `PAY-004` was implemented.

The remaining work is split into:

1. Staging-blocked provider, RLS, storage, migration and browser validation.
2. Qualified legal review and customer/pilot validation.
3. Deferred payment remediation.

## Implemented And Locally Verified

- Attendance, permission, RLS-policy, API-foundation and data-integrity
  remediation.
- Admissions CRM, parent access lifecycle and signed Meta WhatsApp delivery
  handling.
- Offline cache tenant/user scoping, hard expiry, conflict states, retry/discard
  support and logout cleanup.
- Public privacy, terms, data-rights, support and live status pages.
- Dynamic document language, skip navigation, accessible control labels and
  44px-or-larger attendance controls.
- Robots, sitemap, canonical metadata, Open Graph image and private-route
  indexing rules.
- Truthful landing/pricing copy that does not claim online payment processing.
- Public health endpoint, owner/admin support diagnostics, structured redacted
  logs and production operations/privacy runbooks.
- Fee collection reports for daily totals, payment mode, collector and
  outstanding ageing.
- Shared audit coverage for critical non-payment create/update/delete/export,
  attendance, messaging, student, invitation and provider actions.
- Safe API error responses for audited non-payment routes.
- Dependency upgrades with zero known audit vulnerabilities.
- Deterministic consolidated Supabase SQL generation with `--check`, one atomic
  transaction and a transaction-scoped advisory lock.
- Public proxy access for health, trust, SEO metadata and the signed
  communications webhook.

## Staging-Blocked

- Apply the consolidated SQL and run live migration/RLS verification.
- Execute distinct owner, admin, assigned-teacher, unassigned-teacher,
  accountant, parent, anonymous and tenant-A/tenant-B sessions.
- Verify the private `homework` bucket, signed URL expiry and cross-tenant
  storage denial.
- Verify Auth redirects, SMTP invitations, OTP delivery and token expiry
  against a staging clock.
- Verify VAPID push delivery and internal push authentication.
- Verify Meta provider acceptance, template/session rules and signed
  sent/delivered/read/failed callbacks through a public URL.
- Run realistic large-data mobile, offline/reconnect, shared-device logout and
  assistive-technology browser scenarios.
- Inspect query plans, migration lock timing, trigger behavior and restore
  procedures on a restored staging database.
- Connect deployed logs/alerts and perform a restore drill.

These checks are blocked because dedicated staging credentials, role fixtures,
provider credentials and a restored staging database are not available in this
worktree.

## Customer Or Qualified Review

- Qualified review of privacy, terms, retention, children-data, breach and
  cancellation wording.
- Pricing and willingness-to-pay interviews.
- Parent preference for bearer links, OTP or WhatsApp-only updates.
- Accountant validation of collection and ageing reports.
- Telugu/localisation scope by role.
- Segment/local SEO content and customer proof after ICP validation.

## Deferred

- `PAY-001`, `PAY-002`, `PAY-003`, and `PAY-004`: deferred by product
  decision and not production-ready.

## Final Local Verification

- `pnpm test:phase1`: passed.
- `pnpm test:api-foundations`: passed.
- `pnpm test:permissions`: passed.
- `pnpm test:data-integrity`: passed.
- `pnpm test:phase4-crm`: passed.
- `pnpm test:phase4-parent`: passed.
- `pnpm test:phase4-communications`: passed.
- `pnpm test:phase5-readiness`: passed.
- `pnpm test:migrations`: static verification passed; live database verification
  skipped because `RLS_TEST_SUPERUSER_URL` is unavailable.
- `node scripts/generate-consolidated-supabase-sql.mjs --check`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 15 warnings and no errors.
- `pnpm build`: passed on Next.js 16.2.9; 79 static-generation entries
  completed.
- `pnpm test:performance-budget`: passed; largest client chunk 316,543 bytes,
  total client JavaScript 2,168,492 bytes.
- `pnpm audit --audit-level moderate`: passed with zero known vulnerabilities.

Production-mode HTTP smoke on port 3100:

- `/`: `200`
- `/privacy`: `200`
- `/status`: `200`
- `/robots.txt`: `200`
- `/sitemap.xml`: `200`
- `/api/health`: `200`
- unconfigured `/api/communications/webhook`: JSON `503`
- anonymous `/api/attendance`: JSON `401`

## Supabase SQL

Apply:

`prisma/migrations/supabase_non_payment_remediation_all.sql`

The file is generated from the ordered Phase 4-10 source SQL, excludes payment
remediation, is deterministic, uses explicit Data API grants and RLS, and rolls
back the combined transaction if a preflight or DDL statement fails.

## Resume

Resume with the staging checklist in
`docs/operations/production-readiness.md`. Do not mark staging-blocked or
customer-validation items resolved from local evidence alone.
