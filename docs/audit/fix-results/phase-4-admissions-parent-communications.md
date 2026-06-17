# Phase 4 Admissions, Parent Access, And Communications

Date: 18/06/2026

## CRM-001 - Admissions

Status: implemented locally; live tenant/RLS verification pending.

Implemented:

- Overdue follow-up view and existing follow-up dates.
- One-tap call and manual WhatsApp actions on mobile.
- Quick notes and durable lead activity history.
- Normalized phone duplicate signals for existing leads and students.
- Active owner/admin lead assignment.
- Required lost reason.
- Conversion timestamp and history.
- Existing-student conflict refusal plus explicit existing-student linking API.
- Tenant-scoped activity RLS, ownership trigger, application authorization,
  audit events, indexes, migration rollback notes, and focused tests.

Migration: `prisma/migrations/phase8_admissions_crm.sql`.

Validation:

- `pnpm test:phase4-crm`: passed.
- `pnpm test:migrations`: static verification passed; live check blocked.
- `pnpm test:permissions`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 18 existing warnings and no errors.

## PARENT-001 - Parent Access

Status: implemented locally; live Auth/RLS verification pending.

Implemented:

- 30-day bearer-link expiry with migration backfill.
- Secure 256-bit token generation, rotation, revocation, and regeneration.
- Parent access event history without storing token values.
- Owner/admin-only management and audit events.
- Active-student and revoked/expired-link enforcement on portal and notices.
- Clear invalid/expired-link privacy and support UX.
- OTP eligibility checks, generic responses, verification rate limiting, and
  safe provider-error handling.
- Sibling phone/multi-child support retained; changed phones immediately stop
  matching until institution records are corrected.
- Student-page controls show expiry and access history.

Migration: `prisma/migrations/phase9_parent_access.sql`.

Validation:

- `pnpm test:phase4-parent`: passed.
- `pnpm test:migrations`: static verification passed; live check blocked.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 17 existing warnings and no errors.

## MSG-001 - Communications

Status: pending.
