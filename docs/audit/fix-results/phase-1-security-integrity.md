# Phase 1 Security And Integrity Fix Results

Date: 2026-06-18  
Branch: `fix/phase-1-security-integrity`  
Baseline: `f4c14b65df46f34a642317998d188bc5a04464fe`

## Summary

Phase 1 implementation is complete in code. CSV safety is fully verified locally. Attendance, teacher authorization, push, staff invitations, and homework security pass focused tests and production build, but remain pending live database/provider/role-context verification.

## SEC-001 - Attendance Integrity

- Files: `app/api/attendance/route.ts`, `lib/attendance/validation.ts`, `lib/attendance/save.ts`, `prisma/policies/rls.sql`, `prisma/migrations/phase4_attendance_integrity.sql`.
- Decision: validate all students before session replacement, keep replacement in one `withRls` transaction, and strengthen record/session RLS consistency checks. No `institutionId` column was added to `AttendanceRecord` because session ownership plus student/session consistency policies provide the required invariant without denormalisation.
- Tests: valid, unknown, wrong-class, foreign-tenant, inactive, duplicate, and validation-before-delete cases.
- Migration: new attendance policies; rollback is documented in the migration.
- Result: application acceptance criteria pass. Live RLS execution is pending configured test database URLs.

## SEC-002 - Teacher Class Authorization

- Files: `lib/attendance/access.ts`, attendance list/detail pages, attendance API.
- Decision: one shared server helper applies owner/admin access, assigned-teacher scope, accountant denial, and institution-scoped class lookup.
- Tests: owner, assigned teacher, unassigned teacher, accountant, and wrong-tenant class cases.
- Result: focused tests pass. Live distinct-role browser/API verification is pending.

## PUSH-001 - Fail-Closed Push

- Files: `app/api/push/send/route.ts`, `app/api/push/subscribe/route.ts`, `lib/push/send-security.ts`.
- Decision: require a configured internal token, constant-time credential comparison, explicit institution and recipient IDs, active membership validation, payload limits, internal URLs, rate limiting, stale subscription removal, and audit events.
- Tests: missing configuration, invalid credential, internal/external URL, payload size, rejected implicit broadcast, and valid explicit recipient schema.
- Result: local security tests pass. Provider delivery is pending.
- Manual configuration: set `PUSH_SEND_TOKEN` and valid VAPID settings in the deployment secret store.

## EXPORT-001 - CSV Formula Injection

- Files: `lib/export/csv.ts` and all three export routes.
- Decision: central neutralisation before RFC-style CSV quoting; filenames remain sanitized.
- Tests: malicious student, guardian, phone-like, note, tab, CR, quote, comma, and normal text values.
- Result: resolved and verified locally.

## AUTH-001 - Secure Staff Onboarding

- Files: staff direct/reset routes, invitation create/accept routes, team UI, staff UI, `prisma/schema.prisma`, `prisma/migrations/phase4_secure_staff_invitations.sql`.
- Decision: remove direct password creation and sharing; use random 256-bit, seven-day, single-use invitations; atomic acceptance; secure password-recovery email; administrative revoke endpoint; no invitation token serialization in team page.
- Tests: static plaintext/password API checks, atomic acceptance implementation check, typecheck, build.
- Migration: optional staff profile fields on invitations. Rollback drops those four columns.
- Remaining risk: pending-invitation duplicate prevention is application-level; add a database-backed pending invite key if concurrent duplicate creation appears operationally.
- Result: implemented. Live Supabase invitation/reset verification is pending.

## FILE-001 - Homework Upload Security

- Files: homework APIs/pages/client and `lib/homework/attachments.ts`.
- Decision: private object keys, one-hour signed URLs, assigned-class authorization, 5 MB limit, minimal allow-list, extension/MIME/signature checks, server-generated names, class-bound object keys, cleanup on replacement/deletion, and audit events.
- Tests: disallowed type, MIME/extension mismatch, signature mismatch, fake WebP, tenant/class object-key checks.
- Remaining risk: storage deletion is not transactional with PostgreSQL; a failed cleanup can leave a private orphan object and is recorded in audit metadata.
- Manual configuration: ensure the `homework` bucket is private and public-read storage policies are absent.
- Result: implemented. Live storage policy and signed URL expiry verification is pending.

## API-001 And Audit Logging

Modified routes now return stable safe errors and log detailed diagnostics server-side without returning provider/database bodies. Audit coverage was added for attendance, exports, staff invitations, homework, and push. The broader audit issues remain open for routes outside Phase 1.

## Validation Results

- `pnpm test:phase1`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 0 errors and 18 warnings.
- `pnpm build`: passed.
- `pnpm test:rls`: blocked by missing dedicated RLS database environment variables.
- `pnpm audit --audit-level moderate`: failed with 8 dependency advisories.

## Rollback

1. Revert the relevant local commits.
2. Apply the rollback SQL documented in each Phase 1 migration if already deployed.
3. Keep the homework bucket private even during rollback; reverting to public URLs is not an acceptable security rollback.
