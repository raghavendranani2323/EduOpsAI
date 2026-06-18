# Production Operations Runbook

## Monitoring

- Probe `GET /api/health` every minute.
- Alert after two consecutive `503` responses or sustained latency above 2 s.
- Correlate application failures with the returned `x-request-id`.
- Review structured logs for `level=error`, webhook failures, rate-limit
  exhaustion, storage failures, and provider rejection counts.

## Release checklist

1. Back up the Supabase database and confirm the latest restore point.
2. Restore the backup into a separate staging project and confirm the base
   schema exists through Phase 3.
3. Run `node scripts/generate-consolidated-supabase-sql.mjs --check`.
4. Review Phase 7 preflight queries for duplicates, cross-tenant references and
   timetable overlaps.
5. Apply
   `prisma/migrations/supabase_non_payment_remediation_all.sql` once through
   the Supabase SQL Editor or `psql`.
6. Confirm the `non-payment-2026-06-18` row in
   `eduops_remediation_runs`, then rerun the same SQL to verify idempotency.
7. Run `pnpm test:migrations` and `pnpm test:rls` with dedicated
   `RLS_TEST_SUPERUSER_URL` and `RLS_TEST_APP_USER_URL` values.
8. Smoke-test owner, admin, assigned teacher, unassigned teacher, accountant,
   parent, anonymous, tenant-A and tenant-B sessions.
9. Confirm the `homework` bucket is private; test signed URL expiry and
   cross-tenant object denial.
10. Configure and verify Auth redirects, SMTP invitations, OTP, VAPID/internal
    push token, and Meta WhatsApp credentials.
11. Expose the signed Meta callback publicly and verify accepted, sent,
    delivered, read, failed, replay and invalid-signature scenarios.
12. Verify `/api/health`, `/api/support-diagnostics`, public trust/SEO routes,
    logs, alerts and provider failure dashboards.
13. Run mobile offline/reconnect/conflict/logout checks, accessibility checks,
    large-data task tests, query plans and migration lock timing.
14. Complete a staging restore drill and obtain owner approval before
    production rollout.

Do not include `PAY-001` through `PAY-004` in this release checklist; they
remain deferred and not production-ready.

## Database restore

1. Stop application writes or enable maintenance mode.
2. Restore the selected Supabase backup into a separate project first.
3. Verify tenant counts, RLS policies, triggers and critical workflows.
4. Point staging at the restored database and complete smoke tests.
5. Promote only after owner approval; retain the previous database until the
   rollback window closes.

Never test restore procedures for the first time during a production incident.

## Incident response

1. Record start time, impact, affected tenants and request IDs.
2. Disable the affected provider or route if continued writes can corrupt data.
3. Preserve logs and webhook identifiers; do not paste secrets into tickets.
4. Communicate a plain-language update through `/status` and the support
   contact.
5. Restore service, reconcile affected records, and write a post-incident
   review with corrective actions.

## Webhook recovery

- Invalid signatures are never retried manually.
- Provider events should be replayed only from the provider dashboard.
- Check the local message record and provider message ID before replay.
- Delivery state may advance but must never be downgraded.
