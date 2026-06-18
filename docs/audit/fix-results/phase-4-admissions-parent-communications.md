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

Status: implemented locally; live Meta provider/webhook verification pending.

Implemented:

- Removed the console provider and all message-body/phone console logging.
- Added fail-closed Meta WhatsApp Cloud API configuration.
- Sends are recorded as queued before provider submission and are never marked
  sent merely because the application attempted delivery.
- Provider acceptance stores the provider message ID while retaining queued
  status.
- Signed Meta webhooks advance messages through sent, delivered, read, or
  failed states without allowing status downgrades.
- Added delivery timestamps, provider lookup index, owner/admin message update
  policy, legacy console-message correction, and migration rollback notes.
- Updated the UI to report queued rather than sent counts.
- Added provider setup/runbook notes, privileged webhook allowlisting, focused
  signature/status tests, and migration verification.

Migration: `prisma/migrations/phase10_communications_delivery.sql`.

Validation:

- `pnpm test:phase4-communications`: passed.
- `pnpm test:migrations`: static verification passed; live check blocked.
- `pnpm test:phase4-crm`: passed.
- `pnpm test:phase4-parent`: passed.
- `pnpm test:permissions`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 16 existing warnings and no errors.
- `pnpm build`: passed; final repository build later passed on Next.js 16.2.9.

Live provider acceptance, signed webhook delivery receipts, Meta template/session
rules, and production phone-number configuration remain blocked without staging
Meta credentials and a public callback URL.
