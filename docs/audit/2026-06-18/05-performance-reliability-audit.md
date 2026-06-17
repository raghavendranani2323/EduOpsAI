# Performance, Reliability, PWA, And Operations Audit

## Command Results

| Command | Result | Evidence |
|---|---|---|
| `pnpm lint` | Failed | 4 errors and 18 warnings. Errors: raw `<a>` internal links in academic-year client, `react/no-children-prop` in parent page, and `set-state-in-effect` in offline indicator. |
| `pnpm typecheck` | Passed | TypeScript completed successfully. |
| `pnpm build` | Passed | Next.js 16.2.7 production build completed. 69 routes generated/reported. |
| `pnpm test:rls` | Passed | Seeded tenant A/B isolation test passed for selected resources. |
| `pnpm audit --audit-level moderate` | Failed | 8 vulnerabilities: 1 high, 6 moderate, 1 low. |

## Build And Bundle Observations

- Next.js version: 16.2.7.
- Build loaded `.env.local` and `.env`; no secret values were displayed or copied.
- Static build reported public/app/API routes as expected.
- `.next/server/app` contained 203 JS files with approximately 984 KB raw JS in that folder.
- Largest static chunks observed were approximately 316 KB, 242 KB, 233 KB, and 138 KB raw, before gzip/brotli.

No Lighthouse/Core Web Vitals run was completed because this audit focused on local production browser checks and code/runtime inspection. Production CWV should be measured after deployment behind real hosting/CDN configuration.

## PWA And Offline Findings

### Current behaviour

- `public/manifest.json`, PWA icons, `public/offline.html`, and `public/sw.js` exist.
- `public/sw.js` handles install/activate and push notification events.
- The service worker does not intercept fetch requests and does not serve `offline.html`.
- Service worker registration is production-only.
- IndexedDB helpers and a mutation queue exist in `lib/offline/db.ts`.
- Offline attendance appears to use an in-app queued mutation approach.

### Critical mismatch

Marketing and FAQ copy imply offline attendance and syncing. The actual implementation is not a robust offline-first PWA:

- No fetch interception.
- No background sync in the service worker.
- No conflict resolution if another user changes attendance before sync.
- No tenant/user namespace isolation in cache keys was confirmed.
- No logout cleanup for cached data and pending mutations was confirmed.
- No clear failed-sync recovery UX was verified.

### Stale-cache bug

Evidence: `lib/offline/db.ts` returns cached data when the cache age exceeds `maxAgeMs`:

```ts
if (Date.now() - entry.cachedAt > maxAgeMs) return entry.data
```

Expected behaviour is likely to reject or refetch expired data. Current behaviour can keep stale data visible past the configured maximum age.

Severity: P1 because it undermines offline correctness and trust in attendance/fees data.

## Reliability Risks

| ID | Risk | Evidence | Impact | Severity |
|---|---|---|---|---|
| REL-001 | Manual fee payment can overpay under concurrent submits. | Payment route reads invoice, checks remaining, creates payment, then recalculates without row lock/idempotency. | Financial corruption and parent/accountant disputes. | P1 |
| REL-002 | Receipt number assignment happens via GET side effect. | Receipt route assigns receipt number when GET is called. | Race conditions, skipped numbers, hard-to-audit receipts. | P1 |
| REL-003 | Razorpay webhook lacks stored order reconciliation. | Webhook trusts event notes/invoice ID after signature verification. | Wrong invoice amount/status if notes/order mismatch or replay edge occurs. | P1 |
| REL-004 | Offline sync lacks conflict resolution. | SW is push-only; queue is app-level. | Teachers may believe attendance saved when later sync fails or overwrites. | P1 |
| REL-005 | Lint gate fails. | `pnpm lint` failed. | CI/release quality gate is not clean. | P1 |
| REL-006 | Dependency audit fails. | 8 vulnerabilities reported. | Supply-chain and compliance risk. | P2 |
| REL-007 | No health check found. | Route inventory/config review. | Operations cannot reliably monitor availability. | P2 |
| REL-008 | No structured request IDs/error tracking found. | Static review. | Support cannot diagnose school complaints quickly. | P2 |

## Database Performance Concerns

Existing useful indexes include:

- Attendance session uniqueness.
- Attendance records by session/student.
- Guardian phone index.
- Invoice period/status/receipt indexes.
- Student institution/status/class index.
- Razorpay payment ID index.

Likely missing or insufficient indexes:

- Leads by institution, stage, follow-up date, and assigned user.
- Messages by institution, status, created date, and recipient.
- Homework by institution/class/due date.
- Notices by institution/audience/created date.
- Timetable by institution/class/day.
- Audit logs by institution/created/action.

High-risk query areas:

- Dashboard aggregates over students, invoices, attendance, and leads.
- Fee list and reports with many invoices/payments.
- Attendance pages for large classes.
- Imports/exports for thousands of students.
- Message/reminder lists.

## Operational Readiness

Missing or not found:

- Environment schema validation.
- Health check endpoint.
- Uptime check configuration.
- Error tracking such as Sentry/OpenTelemetry.
- Structured logging with request IDs.
- Webhook monitoring and replay dashboard.
- Backup/restore runbook.
- Migration rollback plan.
- Staging release checklist.
- Incident response process.
- Status page.
- Feature flags.
- Tenant-level support diagnostics.
- Support access controls.
- Data correction tools.

Operational single points of failure:

- Supabase database/auth/storage.
- Razorpay order/payment/webhook flow.
- Push provider/VAPID setup.
- Console-only communication provider.
- Manual database migration discipline.
- Founder/operator support availability.

## Release Recommendation

Before a paid pilot:

1. Make lint green.
2. Add health and error monitoring.
3. Add payment idempotency and webhook reconciliation.
4. Fix attendance scope and validation.
5. Remove or qualify offline/payment marketing claims.
6. Add at least the top E2E tests listed in `12-test-evidence.md`.
