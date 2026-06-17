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
