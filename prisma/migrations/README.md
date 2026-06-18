# Database Migration Convention

This repository predates Prisma migration history and stores ordered, manually
applied SQL files directly in this directory. `prisma migrate deploy` does not
discover these files because they are not timestamped migration directories.

For an existing database:

1. Back up the database and test restore access.
2. Apply each unapplied SQL file in lexical phase order with the Supabase SQL
   editor or `psql`.
3. Run `pnpm test:migrations`.
4. Run `pnpm test:rls` with dedicated non-production test credentials.

## Single Supabase SQL Editor runner

For a database that already has the base EduOps schema through Phase 3, use:

`supabase_non_payment_remediation_all.sql`

It combines the Phase 4-10 non-payment remediations in order, replaces the one
concurrent index operation with a normal idempotent index operation suitable
for one SQL Editor run, wraps the changes in one transaction with a
transaction-scoped advisory lock, adds explicit Supabase Data API grants,
hardens helper function execution, and records successful application in
`eduops_remediation_runs`.

Regenerate it after changing a source phase file:

`pnpm sql:consolidate`

Verify that the generated file is current without rewriting it:

`node scripts/generate-consolidated-supabase-sql.mjs --check`

Back up first. Preflight checks intentionally stop execution when duplicate or
cross-tenant data must be reconciled manually. Any failure rolls back the
combined transaction.

Do not run all files blindly against a populated database. Confirm applied
state first because older phase files were not written as a complete
transactional migration chain.

Phase 1 rollback instructions are embedded in:

- `phase4_attendance_integrity.sql`
- `phase4_secure_staff_invitations.sql`

Future schema remediation should introduce a baseline and a standard migration
history only after staging data has been reconciled. Converting these existing
files into new Prisma migration directories without baselining would risk
reapplying historical DDL.
