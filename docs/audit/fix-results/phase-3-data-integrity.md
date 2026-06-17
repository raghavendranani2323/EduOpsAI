# Phase 3 Non-Payment Data Integrity

Date: 18/06/2026
Branch: `audit/non-payment-remediation`
Migration: `prisma/migrations/phase7_non_payment_data_integrity.sql`

## Outcome

`DATA-001` and `DB-001` are implemented locally. Live migration, trigger,
query-plan, and RLS verification remain pending a dedicated staging database.
Payment tables and behaviour were not changed.

The authoritative class academic year is `Class.academicYearId`. The
`Class.academicYear` string remains a compatibility mirror populated by a
database trigger. New application writes cannot update that label directly.

Student admission numbers are unique per institution after trimming and
case-folding. This deliberately does not use student names or guardian phone
numbers: siblings may share a phone and students may share a name. If pilots
require admission-number reuse by academic year, the student model must first
gain an explicit enrolment/year relation; weakening the current institution
constraint without that model would be ambiguous.

## Schema Risk Inventory

| Model | Tenant owner / required links | Delete/archive and duplicate risk | Year/query/RLS notes |
|---|---|---|---|
| Profile | Global auth identity; tenant access through Membership | Profile deletion cascades memberships and teacher-subject links; operational history retains actor IDs | Staff references are checked through active membership |
| Institution | Root tenant | Cascades tenant data; institution deletion requires backup/controlled closure | Every tenant query must scope this ID |
| Membership | Institution + Profile | Unique user/institution; revoked rows retained | New role/revocation indexes support auth checks |
| Invitation | Institution | Token already unique; concurrent pending email duplicates were possible | Partial pending-email unique index; expired pending rows are removed before replacement |
| AcademicYear | Institution | Name already unique per tenant; deletion can null historical links | Authoritative class relation; one-active-year enforcement remains application-level |
| ClassGroup | Institution + optional year | Unique tenant/year/name; nullable year can weaken identity | Class trigger rejects tenant/year mismatch |
| Class | Institution + required authoritative year; optional group/staff | Legacy label drift, duplicate sections, and destructive history cascades were risks | Trigger mirrors year label; unique normalized group/section; API refuses deletion with history |
| Student | Institution + optional current class | Hard deletion lost history; duplicate admission numbers and foreign class IDs were possible | DELETE now archives/unassigns; normalized admission key and class trigger |
| Guardian | Institution | Shared phone is legitimate; duplicate people require product-assisted merge | Institution/phone index supports lookup without forcing uniqueness |
| StudentGuardian | Student + Guardian | Composite PK prevents duplicate links; cross-tenant link was possible | Trigger requires matching institutions |
| Tag | Institution | Tenant/label already unique | Link table composite PK prevents duplicate tagging |
| AttendanceSession | Institution + Class + marker | Class cascade can remove history if raw DB deletion is used | Existing class/date/label unique; class tenant trigger and date index |
| AttendanceRecord | Session + Student | Composite logical unique exists; foreign/wrong-class student risk | Trigger requires same institution/class; existing RLS remains |
| Lead | Institution; converted student optional | Phone duplicates can be legitimate; conversion must remain explicit | Stage/follow-up and phone indexes; duplicate signals handled in Phase 4 |
| MessageTemplate | Institution | Duplicate templates are product-safe | Tenant RLS; no new constraint |
| Message | Institution; template optional | Duplicate sends need idempotency, not a content uniqueness rule | Status/time and recipient/time indexes |
| Subject | Institution + optional Class | Duplicate normalized names and foreign classes were possible | Separate global/class partial unique indexes and class scope trigger |
| Exam | Institution + optional Class | Legacy year label remains separate; deleting exam cascades results | Class scope trigger; institution/class/date index |
| ExamResult | Institution + Exam/Student/Subject | Existing unique pair protects duplicates; cross-scope references were possible | Scope trigger plus student/subject lookup indexes |
| TimetableSlot | Institution + Class; optional Subject/Teacher | Exact and overlapping class/teacher collisions were possible | API + trigger validate range, tenant scope, and overlaps |
| Homework | Institution + Class + creator; optional Subject | Historical class deletion is blocked; attachment storage cleanup is separate | Subject/teacher FKs and scope trigger validate class, subject, and active staff |
| Notice | Institution + author; optional Class | Author/class had no database tenant backstop | Author/class FKs, scope trigger, and feed indexes |
| NoticeRead | Notice + Student | Existing logical unique; missing student FK and cross-tenant risk | Student FK, explicit RLS, and tenant-consistency policy |
| LeaveRequest | Institution + user ID | User/approver are scalar IDs without FKs; history should be retained | Follow-up hardening remains open because workflow ownership is not implemented |
| PushSubscription | Endpoint primary key + user | Endpoint duplicate already impossible; institution is derived from active membership | User index exists; live VAPID/provider verification remains blocked |
| AuditLog | Optional Institution + actor scalar ID | Deliberately append-only; actor can outlive profile | Institution/action/time index added; actor/time can be added if measured |

## Pre-Migration Audit

The migration aborts without deleting data when it finds:

- duplicate normalized admission numbers;
- duplicate or overlapping timetable slots;
- duplicate class sections;
- duplicate pending invitations;
- duplicate attendance records, guardian links, notice reads, exam results, or
  push endpoints;
- academic-year mirror/group inconsistencies;
- invalid notice-read references;
- cross-tenant or cross-class student, guardian, attendance, exam-result,
  homework, timetable, or notice references.

If a check fails, export the offending IDs, decide the canonical row with the
institution owner, correct data in a reviewed transaction, rerun all checks,
and only then apply the migration. Ambiguous rows must never be auto-deleted.

## Index Review

| Query improved | Existing coverage | Phase 3 change | Cost / redundancy decision |
|---|---|---|---|
| Active membership by institution/role or user | User/institution unique only | Role/revoked and user/revoked indexes | Small write cost; high-frequency auth path |
| Pending invitations by tenant/email/expiry | Token unique | Pending email unique plus status lookup | Prevents races; expired rows cleaned by app |
| Classes by year, teacher, group | Single relation indexes varied by legacy SQL | Tenant-prefixed indexes | Supports scoped lists and permissions |
| Students by class/status/admission | Class/status index | Normalized admission unique | Removed redundant plain admission index |
| Guardian phone lookup | Global phone index | Tenant/phone index | Preserves sibling sharing |
| Attendance by tenant/date | Session logical unique | Tenant/date index | Supports daily reporting |
| Leads by stage/follow-up and phone | None confirmed | Two tenant-prefixed indexes | Phase 4 CRM paths |
| Messages by status/recipient/time | None confirmed | Two tenant-prefixed indexes | Moderate write/storage cost |
| Subjects by class/name | None confirmed | Normalized partial unique indexes | Prevents ambiguous subject selection |
| Exams/results by class/student/subject | Result logical unique | Exam date plus result student/subject indexes | Supports marks and parent history |
| Timetable by class/teacher/day | Basic class reads | Class/day and teacher/day indexes | Supports conflict checks |
| Homework/notices by class/date/audience | None confirmed | Tenant-prefixed date indexes | Supports operational feeds |
| Audit logs by action/time | Institution/time and actor | Institution/action/time index | Supports incident investigation |

## Application Changes

- Student create, edit, import, and lead conversion validate normalized
  admission uniqueness and class tenancy before writing.
- Student DELETE now archives and unassigns instead of destroying history.
- Class DELETE refuses classes with attendance, homework, exam, or notice
  history instead of relying on destructive cascades.
- Class edit no longer accepts the deprecated academic-year label.
- Timetable create/update validates tenant-scoped references, time ranges, and
  overlapping class/teacher slots before writing.
- Invitation creation removes an expired pending row before creating a new one.
- Both seed paths create and reference an AcademicYear relation.
- Student and timetable mutations now append audit events.

## Migration Order And Rollback

Apply manually in lexical phase order after backup:

1. `phase5_api_foundations.sql`
2. `phase6_permission_hardening.sql`
3. `phase7_non_payment_data_integrity.sql`

The repository uses ordered SQL files rather than Prisma migration history.
Rollback instructions are embedded in Phase 7. Backfilled academic-year rows
and class relation values are retained because removing correct relational
data would be destructive.

## Verification

Local static/unit verification covers normalized admission behaviour,
wrong-tenant class references, timetable ranges/conflicts, archive behaviour,
required duplicate checks, migration metadata/objects, and both seed paths.

Completed commands:

- `pnpm test:data-integrity`: passed.
- `pnpm test:migrations`: static verification passed; live check skipped.
- `pnpm test:phase1`: passed.
- `pnpm test:api-foundations`: passed.
- `pnpm test:permissions`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 18 existing warnings and no errors.
- `pnpm build`: passed; Next.js 16.2.7 generated 69 static pages.
- `pnpm audit --audit-level moderate`: failed with the recorded 8 advisories
  (1 high, 6 moderate, 1 low).
- `pnpm test:rls`: blocked because dedicated test URLs are not configured.

Blocked staging checks:

- execute preflight and migration against a restored staging copy;
- verify trigger failures inside rollback-only transactions;
- run `pnpm test:rls` with dedicated superuser/app-user URLs;
- inspect `EXPLAIN (ANALYZE, BUFFERS)` for documented query patterns;
- verify lock duration and index sizes on realistic data.
