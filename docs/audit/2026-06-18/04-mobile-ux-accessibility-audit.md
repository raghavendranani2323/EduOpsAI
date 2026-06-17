# Mobile UX And Accessibility Audit

## Viewports Tested

Browser checks were run against the local production server using the existing authenticated owner session.

| Viewport | Route(s) | Result | Notes |
|---|---|---|---|
| 320x568 | `/dashboard` | Rendered | No console errors or horizontal overflow found. Above-fold content is tight; only shell/top content is visible. |
| 360x640 | `/dashboard`, `/attendance/[classId]` | Rendered | Attendance page was usable, but direct status picker buttons measured 40px wide. |
| 375x667 | `/dashboard` | Rendered | Dashboard content visible, no overflow. |
| 390x844 | `/dashboard`, `/fees`, `/students`, `/classes`, `/attendance`, `/settings/team`, `/admissions`, `/communications`, `/homework`, `/notices`, `/exams`, `/timetable` | Rendered | All sampled routes loaded without console errors or horizontal overflow. |
| 412x915 | `/dashboard` | Rendered | No overflow. |
| 768x1024 | `/dashboard` | Rendered | Tablet layout usable. |
| 1280x720 | `/dashboard` | Rendered | Desktop shell usable. |
| 1440x900 | `/dashboard` | Rendered | Desktop shell usable. |

## Mobile Workflow Findings

### Attendance marking

Status: Strong foundation, not production-ready.

Evidence:

- `/attendance/[classId]` at 360x640 showed class name, date, Mark/History tabs, Present/Absent/Late/Half counts, Copy yesterday, Mark rest present, two student rows, and a sticky submit button.
- Primary row controls measured approximately 305x64, which is good for thumb use.
- Status picker buttons measured approximately 40x64, below the 44px touch target expectation.
- Hint text rendered as `Tap a student to cycle P -> A -> L -> HD, or use  to pick directly`, indicating an icon or inline element is missing from the text experience.

Expected:

- A teacher on a 5-6 inch Android phone should be able to mark a full class one-handed without mis-taps.

Risks:

- Small status targets increase errors.
- Server-side teacher scope is missing, so good mobile UX does not equal safe role behaviour.
- Offline queue is partial and conflict handling is missing.

Recommended change:

- Make each status action at least 44x44 CSS pixels.
- Replace icon-dependent hint with text that remains meaningful if the icon is not read/rendered.
- Add a timed E2E test for 40-60 students on 360x640.

### Fee collection

Status: Partial.

Evidence:

- `/fees` rendered mobile cards/KPIs and filters at 390x844.
- Parent payment pages explicitly say online payment is coming soon.
- Manual payment API has concurrency risk.

Mobile risk:

- Recording a fee while speaking to a parent must be fast, idempotent, and confidence-building. Current flow needs duplicate-submit protection, receipt assurance, daily summary, and payment-mode reports.

### Student lookup

Status: Partial.

Evidence:

- `/students` rendered four students cleanly at 390x844.

Untested/high-risk cases:

- 1,000+ students.
- Long Telugu names.
- Duplicate names.
- Same guardian phone for siblings.
- Poor network.
- Keyboard overlap during search/filter.

### Admissions follow-up

Status: Early.

Evidence:

- `/admissions` rendered an empty Kanban board with zero active leads.

Mobile risk:

- A real counsellor workflow needs call/WhatsApp actions, follow-up dates, duplicate detection, ownership, quick note capture, and lost reason. Empty Kanban alone is not enough.

### Parent portal

Status: Partial.

Evidence:

- Parent routes exist.
- Invalid token returned 404.
- Parent payment is not complete.

Mobile risk:

- Parent portal must be understandable without training. Current trust language, payment support, token lifecycle, and Telugu/low-bandwidth verification need more work.

## Accessibility Findings

| ID | Finding | Evidence | Impact | Severity |
|---|---|---|---|---|
| A11Y-001 | Telugu text is shown while root document language remains English. | `app/layout.tsx` sets app-level language statically; browser showed Telugu navigation labels. | Screen readers may use wrong pronunciation; regional-language trust suffers. | P2 |
| A11Y-002 | Attendance picker targets are below 44px width. | Browser measurement on 360x640. | Mis-taps for teachers on small phones. | P2 |
| A11Y-003 | Missing or unclear accessible name for icon-style back/navigation control. | Attendance page snapshot showed link control without meaningful visible label. | Keyboard/screen-reader users may not know destination. | P2 |
| A11Y-004 | No skip link found. | Static layout review. | Keyboard users must tab through navigation on every page. | P3 |
| A11Y-005 | Lint reports `react/no-children-prop` in parent page. | `app/parent/page.tsx:132`. | Can produce poor semantics/maintainability. | P1 because lint gate fails. |
| A11Y-006 | Dialog focus trapping, Escape behaviour, and 200 percent zoom were not fully verified. | Browser audit limitation. | Risk for older staff and keyboard users. | P2 |

## Mobile-First Verdict By Workflow

| Workflow | Designed for mobile or adapted? | Verdict |
|---|---|---|
| Attendance | Mostly mobile-designed | Keep, but fix server scope, touch targets, offline conflict handling. |
| Student lookup | Mobile-adapted | Needs large data testing and faster filters. |
| Fee collection | Mobile-adapted | Needs cashier/accountant speed, receipt confidence, and duplicate protection. |
| Admissions | Desktop concept adapted to mobile | Needs call/WhatsApp-first follow-up workflow. |
| Homework/notices | Mobile-adapted | Needs teacher creation speed and attachment safety. |
| Parent portal | Mobile-first intent | Needs payment, trust, consent, and language polish. |

## Recommended Mobile Acceptance Tests

1. Mark 50-student attendance on 360x640 in under two minutes with no accidental status changes.
2. Search a student with a long Telugu name on 320x568 while keyboard is open.
3. Record a cash fee payment on 360x640 with network latency and double-tap submit.
4. Share a WhatsApp reminder from a fee invoice.
5. Create homework with attachment from a teacher session.
6. Parent opens token portal on 360x640 and finds fee due, notice, and homework without training.
7. Switch English/Telugu and run screen-reader label checks.
