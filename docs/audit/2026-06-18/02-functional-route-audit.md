# Functional Route Audit

Evidence sources: App Router inventory, production build route output, browser checks against local production server at `http://localhost:3000`, static code review, and direct unauthenticated HTTP probes where reliable.

Limitations:

- Browser had an existing authenticated owner session for `Phase One Public School`; public `/` redirected to `/dashboard`, so logged-out landing testing was limited to static code review.
- No separate live teacher/accountant/parent browser sessions were available. Role restrictions were reviewed through code and route/API tests where possible.
- Direct unauthenticated PowerShell `Invoke-WebRequest -MaximumRedirection 0` did not consistently expose redirect status because `.Exception.Response` was null for several protected routes.

Severity meanings: P0 critical, P1 high, P2 medium, P3 low, Obs informational.

## Route Summary

| Route | Role/Test Context | Status | Tested Behaviour | Issues | Evidence | Severity |
|---|---|---|---|---|---|---|
| `/` | Existing owner session | Partial | Redirected to `/dashboard` because session existed. Landing reviewed statically. | Landing claims UPI/Razorpay and offline capability ahead of product reality. Public logged-out conversion not fully browser-tested. | `components/landing/hero.tsx`, `components/landing/pricing.tsx`; browser opened `/` and landed on `/dashboard`. | P1 |
| `/login` | Static/code | Present | Public auth route exists. | Need account enumeration/brute force/error UX testing with real Supabase auth. | App inventory and auth code review. | P2 |
| `/signup` | Static/code | Present | Public signup route exists. | No paid-trial gating, spam protection, or support onboarding readiness found. | App inventory. | P2 |
| `/teacher-login` | Static/code | Present | Teacher login route exists. | Needs separate teacher session E2E. Teacher route/API lockdown is incomplete for attendance. | App inventory; attendance findings. | P1 |
| `/accept-invite/[token]` | Static/code | Present | Invitation acceptance route exists. | Need expired/reused invitation browser tests. | App inventory. | P2 |
| `/onboarding` | Existing owner session | Rendered | Local browser could access onboarding content in session. | Need logged-out protection verification and first-value activation tests. | Browser session, route inventory. | P2 |
| `/dashboard` | Owner, 320-1440 widths | Rendered | Dashboard displayed school name, onboarding checklist, KPIs, action-needed panels. No console errors/horizontal overflow in sampled viewports. | At 320/360 very little above-fold operational content is visible; needs low-end Android task testing. | Browser viewport checks. | P2 |
| `/classes` | Owner, 390x844 | Rendered | Class list showed Class 6 with two sections and head teacher. | Duplicate visible class names can confuse users if section is not prominent. | Browser sample route. | P3 |
| `/classes/[id]` | Static/code | Present | Dynamic class route exists. | Need role, tenant, loading/error/back navigation tests. | Route inventory. | P2 |
| `/students` | Owner, 390x844 | Rendered | Student list displayed 4 students. No horizontal overflow. | Large list/search/pagination and long-name/Telugu tests still needed. | Browser route sample. | P2 |
| `/students/new` | Static/code | Present | Student creation page exists. | Needs mobile keyboard, duplicate admission number, guardian phone, audit-log, and validation E2E. | Route inventory; schema review. | P2 |
| `/students/import` | Static/code | Present | Import route exists. | CSV abuse, huge file, duplicate rows, formula injection, and import template quality need testing. | Route inventory; export/import review. | P1 |
| `/students/[id]` | Static/code | Present | Dynamic student profile exists. | Needs IDOR, role, tenant, stale data, edit/delete/guardian tests. | Route inventory. | P1 |
| `/attendance` | Owner, 390x844 | Rendered | Date 18/06/2026, two pending classes, class cards link to marking. | Teacher class scoping exists on list page only. Need holiday/future/archive tests. | `app/(app)/attendance/page.tsx:24-32`; browser sample. | P1 |
| `/attendance/[classId]` | Owner, 360x640 | Rendered | Attendance marking page displayed 2 students, Mark/History tabs, counts, Copy yesterday, Mark rest present, Submit. No overflow. | Teacher scope missing. Status picker buttons 40px wide. Hint text lost icon context. API accepts unvalidated student IDs. | `app/(app)/attendance/[classId]/page.tsx:30-36`; browser element measurements; `app/api/attendance/route.ts`. | P0/P1 |
| `/fees` | Owner, 390x844 | Rendered | Showed Generate/Plans, INR KPIs, filters, empty June 2026 invoices. | Duplicate class option labels; parent online payment not complete; financial reports thin. | Browser sample. | P1 |
| `/fees/generate` | Static/code | Present | Bulk invoice generation route exists. | Needs idempotency, duplicate invoice, concurrency, partial failure, and audit tests. | Route inventory; API review. | P1 |
| `/fees/plans` | Static/code | Present | Fee plans route exists. | Needs component validation, discount, academic-year scoping, and duplicate plan tests. | Route inventory. | P2 |
| `/fees/invoices/[id]` | Static/code | Present | Invoice detail route exists. | Manual payment race/idempotency risk; receipt GET has side effects; Razorpay parent path incomplete. | `app/api/fees/invoices/[id]/payments/route.ts`; receipt route. | P1 |
| `/admissions` | Owner, 390x844 | Rendered | Empty Kanban stages displayed. | Currently closer to a lead board than a full CRM: follow-up reminders, duplicate detection, ownership, history, conversion attribution need verification/buildout. | Browser sample; API/schema review. | P2 |
| `/communications` | Owner, 390x844 | Rendered | Empty template state displayed. | Provider is console-only and marks as sent without real delivery. No production delivery status/retry/consent. | `lib/messaging/provider.ts`; `app/api/communications/send/route.ts`. | P1 |
| `/exams` | Owner, 390x844 | Rendered | Empty exam state displayed. | Need marks entry, grading, absent marks, publishing, parent visibility, and teacher scope E2E. | Browser sample. | P2 |
| `/exams/[id]/marks` | Static/code | Present | Marks route exists. | Need large class, validation, duplicate save, publish/correction/audit tests. | Route inventory. | P2 |
| `/timetable` | Owner, 390x844 | Rendered | Empty timetable state displayed. | Needs teacher assignment consistency and clash validation. | Browser sample; schema review. | P2 |
| `/homework` | Owner, 390x844 | Rendered | Empty homework state displayed. | Upload API allows public service-role uploads with weak content validation and broad member access. | `app/api/homework/upload/route.ts`. | P1 |
| `/notices` | Owner, 390x844 | Rendered | Empty notices state displayed. | Need audience scoping, parent read tracking, teacher permissions, and push/send integration tests. | Browser sample; API inventory. | P2 |
| `/more` | Static/code | Present | More route exists for mobile navigation overflow. | Needs role-specific content verification. | Route inventory. | P2 |
| `/settings` | Static/code | Present | Settings route exists. | Needs role restriction verification for teacher/accountant deep links. | Route inventory. | P1 |
| `/settings/academic-year` | Static/lint | Present | Academic-year UI exists. | Lint fails because raw `<a>` is used for internal routes. Academic-year rollover/promotion not complete. | `app/(app)/settings/academic-year/academic-year-client.tsx:283,287`; `pnpm lint`. | P1 |
| `/settings/team` | Owner, 390x844 | Rendered | Add teacher form and team count displayed. | Direct staff flow returns plaintext generated password and WhatsApp credential share. | Browser sample; `app/api/staff/direct/route.ts`. | P1 |
| `/settings/institution` | Static/code | Present | Institution settings route exists. | Needs tenant-switch, long school name, logo/assets, and audit tests. | Route inventory. | P2 |
| `/settings/notifications` | Static/code | Present | Notification settings route exists. | Push subscription/send design is unsafe/incomplete. | Push API review. | P1 |
| `/settings/export` | Static/code | Present | Export route exists. | CSV formula injection risk; export authz must be tested for all roles. | `lib/export/csv.ts`; export API review. | P1 |
| `/settings/audit-log` | Static/code | Present | Audit log page exists. | Logs are sparse and do not cover many sensitive actions. | Audit API/schema review. | P1 |
| `/p/[token]` | Static/code and direct invalid token | Present | Invalid token returned 404. Token portal code uses bearer token lookup. | Long-lived token has no expiry/rotation/revocation UI. Parent payment says coming soon. | `app/p/[token]/page.tsx`; invalid token probe. | P1 |
| `/p/[token]/notice/[noticeId]` | Static/code | Present | Notice detail route exists. | Need token notice scoping/read tracking/revocation tests. | Route inventory. | P2 |
| `/parent/login` | Static/code | Present | Parent OTP login route exists. | Need phone enumeration, OTP rate limit, consent, and multi-child tests. | Parent auth API review. | P2 |
| `/parent` | Static/code | Present | Parent authenticated portal exists. | Online payment says coming soon; payment CTA mismatch with marketing. | `app/parent/page.tsx:151-155`; lint error at `app/parent/page.tsx:132`. | P1 |
| `/_not-found` | Build output | Present | Framework not-found route exists. | No issue. | `pnpm build`. | Obs |

## Workflow Verdicts

| Workflow | Verdict | Evidence |
|---|---|---|
| Institution signup/onboarding | Partial | Routes exist; browser saw onboarding checklist. Full logged-out signup and activation path not tested. |
| Class/student setup | Partial | Routes and APIs exist; browser showed data. Duplicate/validation/import cases need E2E. |
| Attendance | Not production-ready | UI is strong, but teacher server-side scope and student ID validation are blockers. |
| Fees/invoices | Not production-ready | Internal lists and APIs exist; parent payment incomplete; payment concurrency/reconciliation gaps. |
| Admissions CRM | Partial | Kanban exists but evidence suggests early lead board rather than complete CRM. |
| Communications | Not production-ready | Console provider only; delivery status is misleading. |
| Homework/notices | Partial | Surfaces exist; upload/public file and audience/read tests needed. |
| Exams/marks | Partial | Pages exist; no E2E verification of grading/publish/parent view. |
| Parent portal | Partial | Token and OTP routes exist; payment incomplete and token lifecycle weak. |
| Exports | Partial | Export routes exist; CSV formula injection and role/tenant tests needed. |
