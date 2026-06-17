# EduOps AI Production And Product-Market Audit - Executive Summary

Audit date: 18/06/2026
Repository: `C:\Users\user\Desktop\EduOps`
Branch: `master`
Baseline commit: `f4c14b65df46f34a642317998d188bc5a04464fe` - `Teacher-focused experience: role-aware navigation + financial/admin lockdown`

## Overall Verdict

EduOps AI is a credible early SaaS product with a strong Indian school/coaching workflow direction, a coherent mobile shell, role-aware navigation, Prisma/Postgres RLS groundwork, and working core surfaces for students, classes, attendance, fees, admissions, homework, notices, exams, timetable, parent access, exports, and settings.

It is not production-ready for paying institutions today. The application still has launch-blocking issues in attendance authorisation, financial integrity, payment completeness, push security, offline truthfulness, auditability, CSV export safety, operational readiness, and test coverage.

## Production-Readiness Verdict

Do not accept paying customers yet, except possibly a controlled unpaid pilot with non-critical data, explicit limitations, and founder-led support.

Confirmed readiness positives:

- `pnpm typecheck` passed.
- `pnpm build` passed on Next.js 16.2.7.
- `pnpm test:rls` passed its existing cross-tenant smoke tests for seeded students, classes, invoices, notices, and fee plans.
- Authenticated app routes rendered locally in production mode without browser console errors in sampled mobile and desktop viewports.

Launch blockers:

- `pnpm lint` failed with four errors.
- Teacher attendance scope is enforced on the list page but not on the detail page or attendance API.
- Attendance API accepts arbitrary `studentId` values for a class without verifying class membership or institution ownership.
- Parent-facing online payment is explicitly "coming soon" while landing/pricing copy claims UPI/Razorpay fee collection.
- Razorpay webhook and manual payment flows lack enough reconciliation, idempotency, and concurrency protection.
- Push send endpoint is unsafe if the shared send token is not configured.
- Communications use `ConsoleProvider`, can mark messages as sent without real delivery, and logs PII to server logs.
- Offline marketing claims exceed the actual service worker and sync implementation.
- Critical operational controls are missing: health checks, monitoring, structured request IDs, backup/restore runbooks, environment validation, incident response, and release checklist.

## Mobile-First Verdict

Partially mobile-first. The authenticated shell, bottom navigation, dashboard, student list, fees list, and attendance marking page are clearly designed for phones. Runtime checks at 320, 360, 375, 390, 412, 768, 1280, and 1440 widths showed no horizontal overflow in sampled routes.

However, the product is not yet fully mobile-operational:

- Attendance status picker buttons measured 40px wide on 360px mobile, below the WCAG 2.2 44px touch-target expectation.
- Some dense workflows still rely on table/list patterns that need more low-end Android testing with large classes and large invoices.
- Offline attendance only works as an in-app queue in limited conditions, not as robust offline-first PWA sync.
- Accessibility gaps, stale-cache behavior, and missing conflict handling reduce trust for teachers using poor networks.

## Security Verdict

Not ready. The highest risks are broken object-level authorisation in attendance, possible cross-tenant data contamination in attendance records if foreign student IDs are submitted, weak push endpoint protection, CSV injection, long-lived parent bearer links, public homework uploads, plaintext staff password sharing, sparse audit logging, missing security headers, and insufficient payment reconciliation.

Security posture is better than a typical prototype because:

- Most tables have RLS enabled.
- Existing RLS smoke tests passed.
- Many API routes call `requireInstitution()` and use `withRls(userId, fn)`.
- `prismaAdmin` is usually scoped by `institutionId`.

But production SaaS trust requires server-side permission checks on every mutation, not only role-aware navigation.

## Tenant-Isolation Verdict

Structurally promising but not proven production-safe. RLS is enabled on the main tenant tables, and existing RLS tests passed. The schema generally includes `institutionId` on tenant resources.

The key blocker is attendance record insertion: the API and RLS policy validate the attendance session's institution but do not validate that every submitted `studentId` belongs to the same institution and class. This creates a possible cross-tenant data-contamination path if an attacker obtains or guesses a foreign student ID.

## Product-Market Verdict

EduOps AI should not position itself as a full school ERP yet. The strongest near-term opportunity is a focused, mobile-first operating system for small coaching centres and tuition centres that need:

- Fast student lookup
- Daily attendance
- Fee collection and follow-up
- Admissions follow-up
- Homework/notices
- WhatsApp-first parent communication
- Simple owner/accountant visibility

For this segment, EduOps can compete by being lighter, faster, more affordable, more mobile-first, and less implementation-heavy than broad ERP platforms such as Fedena, MyClassboard, Entab, and Campus 365, while avoiding direct competition with creator/live-class-heavy platforms such as Classplus.

## Top Strengths

- Role-aware navigation has started, including teacher hiding of financial/admin areas.
- Mobile authenticated shell is practical and fast in local checks.
- Prisma schema covers a wide set of education workflows.
- RLS exists and current RLS smoke tests passed.
- Attendance, fees, admissions, homework, notices, exams, timetable, parent portal, and exports exist as vertical surfaces.
- Indian conventions are visible: INR, DD/MM/YYYY needs, +91 phone handling in places, WhatsApp links, Telugu navigation.
- The product is not merely a landing page; it has real operational modules.

## Top Blockers

1. Attendance authorisation and student validation are not safe enough for production.
2. Fees/Razorpay is incomplete and financially fragile.
3. Communications and push are not production-grade.
4. Offline/PWA claims are ahead of the implementation.
5. Audit logging, testing, monitoring, and operational recovery are insufficient for paid schools.

## Recommended Initial Customer Segment

Primary ICP: owner-led coaching centres and tuition centres in Tier 2 and Tier 3 Indian cities with 100-800 students, 3-25 staff, mixed cash/UPI collections, WhatsApp-heavy parent communication, spreadsheet/register dependency, and no appetite for a heavy ERP implementation.

Avoid first targeting:

- Large K-12 schools needing transport, payroll, inventory, library, board-specific report cards, complex approvals, and high customisation.
- Preschools until parent communication, photo/media workflows, daily activity reports, consent, and child-safety trust language are stronger.
- Franchise coaching chains until branch management, custom roles, reporting, and support tooling exist.

## Recommended Positioning

"Mobile-first fee, attendance, and parent communication software for Indian coaching and tuition centres that want to stop running on registers, spreadsheets, and scattered WhatsApp messages."

Do not lead with generic AI claims. Lead with measurable operational outcomes:

- Mark attendance in under two minutes.
- See who has not paid this month.
- Share fee reminders on WhatsApp.
- Convert admissions enquiries into students.
- Give parents a simple mobile link for fees, notices, homework, and attendance.

## Immediate Founder Decision

Pause paid launch. Run a controlled pilot only after P0/P1 fixes are complete for attendance permissions, payment integrity, parent payment truthfulness, push/communications safety, CSV export safety, and operational monitoring. Use the pilot to validate the coaching-centre ICP and the willingness-to-pay hypothesis before expanding into full ERP breadth.

## Finding Counts

- P0 Critical: 1
- P1 High: 16
- P2 Medium: 16
- P3 Low: 7
- Observations: 5
