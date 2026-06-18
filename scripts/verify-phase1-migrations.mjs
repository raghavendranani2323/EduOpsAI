import { readFile } from "node:fs/promises";
import { Client } from "pg";

const attendancePath = "prisma/migrations/phase4_attendance_integrity.sql";
const invitationsPath = "prisma/migrations/phase4_secure_staff_invitations.sql";
const foundationsPath = "prisma/migrations/phase5_api_foundations.sql";
const permissionsPath = "prisma/migrations/phase6_permission_hardening.sql";
const integrityPath = "prisma/migrations/phase7_non_payment_data_integrity.sql";
const crmPath = "prisma/migrations/phase8_admissions_crm.sql";
const parentPath = "prisma/migrations/phase9_parent_access.sql";
const communicationsPath = "prisma/migrations/phase10_communications_delivery.sql";
const consolidatedPath = "prisma/migrations/supabase_non_payment_remediation_all.sql";

const [attendanceSql, invitationsSql, foundationsSql, permissionsSql, integritySql, crmSql, parentSql, communicationsSql, consolidatedSql] = await Promise.all([
  readFile(attendancePath, "utf8"),
  readFile(invitationsPath, "utf8"),
  readFile(foundationsPath, "utf8"),
  readFile(permissionsPath, "utf8"),
  readFile(integrityPath, "utf8"),
  readFile(crmPath, "utf8"),
  readFile(parentPath, "utf8"),
  readFile(communicationsPath, "utf8"),
  readFile(consolidatedPath, "utf8"),
]);

const requiredAttendancePolicies = [
  "att_sess_insert",
  "att_sess_update",
  "att_rec_insert",
  "att_rec_update",
  "att_rec_delete",
];
for (const policy of requiredAttendancePolicies) {
  if (!attendanceSql.includes(`CREATE POLICY ${policy}`)) {
    throw new Error(`${attendancePath} is missing ${policy}`);
  }
}
for (const required of [
  "CREATE TABLE IF NOT EXISTS parent_access_events",
  "CREATE POLICY parent_access_events_select",
  "portalTokenExpiresAt",
]) {
  if (!parentSql.includes(required)) {
    throw new Error(`${parentPath} is missing ${required}`);
  }
}
for (const required of [
  "BEGIN;",
  "pg_advisory_xact_lock",
  "phase4_attendance_integrity.sql",
  "phase10_communications_delivery.sql",
  "eduops_remediation_runs",
  "REVOKE ALL ON TABLE rate_limit_counters",
  "NOTIFY pgrst, 'reload schema'",
  "COMMIT;",
]) {
  if (!consolidatedSql.includes(required)) {
    throw new Error(`${consolidatedPath} is missing ${required}`);
  }
}
if (consolidatedSql.includes("CREATE INDEX CONCURRENTLY")) {
  throw new Error(`${consolidatedPath} must be runnable as one Supabase SQL Editor script`);
}
if (consolidatedSql.includes("pg_advisory_lock(") || consolidatedSql.includes("pg_advisory_unlock(")) {
  throw new Error(`${consolidatedPath} must use a transaction-scoped advisory lock`);
}
for (const required of [
  "messages_provider_message_id_idx",
  "CREATE POLICY msg_upd",
  "Legacy console delivery was not verified",
  "Rollback:",
  "Staging verification:",
]) {
  if (!communicationsSql.includes(required)) {
    throw new Error(`${communicationsPath} is missing ${required}`);
  }
}
for (const required of [
  "CREATE TABLE IF NOT EXISTS lead_activities",
  "CREATE TRIGGER leads_owner_scope",
  "CREATE POLICY lead_activity_select",
]) {
  if (!crmSql.includes(required)) {
    throw new Error(`${crmPath} is missing ${required}`);
  }
}

for (const column of ['"fullName"', "phone", "designation", "qualification"]) {
  if (!invitationsSql.includes(column)) {
    throw new Error(`${invitationsPath} is missing ${column}`);
  }
}
if (!foundationsSql.includes("CREATE TABLE IF NOT EXISTS rate_limit_counters")) {
  throw new Error(`${foundationsPath} is missing rate_limit_counters`);
}
if (!permissionsSql.includes("CREATE OR REPLACE FUNCTION can_access_class")) {
  throw new Error(`${permissionsPath} is missing can_access_class`);
}
if (!integritySql.includes("CREATE TRIGGER classes_academic_consistency")) {
  throw new Error(`${integrityPath} is missing academic consistency trigger`);
}
for (const required of [
  "Preconditions:",
  "Backfill:",
  "RLS:",
  "Lock/performance:",
  "Rollback:",
  "Staging verification:",
  "Production verification:",
  "students_institution_admission_no_key",
  "invitations_pending_email_key",
  "timetable_slots_scope_collision",
  "Cross-tenant or cross-class references",
]) {
  if (!integritySql.includes(required)) {
    throw new Error(`${integrityPath} is missing ${required}`);
  }
}

const url = process.env.RLS_TEST_SUPERUSER_URL;
if (!url) {
  console.log("Ordered remediation migration SQL passed static verification.");
  console.log("Live migration verification skipped: RLS_TEST_SUPERUSER_URL is not configured.");
  process.exit(0);
}

const db = new Client({ connectionString: url });
await db.connect();
try {
  const columns = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invitations'
      AND column_name = ANY($1::text[])
  `, [["fullName", "phone", "designation", "qualification"]]);
  if (columns.rowCount !== 4) {
    throw new Error("Secure invitation columns are not fully applied");
  }

  const policies = await db.query(`
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('attendance_sessions', 'attendance_records')
      AND policyname = ANY($1::text[])
  `, [requiredAttendancePolicies]);
  if (policies.rowCount !== requiredAttendancePolicies.length) {
    throw new Error("Attendance integrity policies are not fully applied");
  }

  const rls = await db.query(`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname IN ('attendance_sessions', 'attendance_records')
  `);
  if (rls.rows.length !== 2 || rls.rows.some((row) => !row.relrowsecurity)) {
    throw new Error("Attendance RLS is not enabled");
  }

  const rateLimitTable = await db.query(`
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = 'rate_limit_counters'
  `);
  if (rateLimitTable.rowCount !== 1 || !rateLimitTable.rows[0].relrowsecurity) {
    throw new Error("Rate limit table is missing or RLS is not enabled");
  }

  const permissionFunction = await db.query(`
    SELECT 1
    FROM pg_proc
    WHERE proname = 'can_access_class'
  `);
  if (permissionFunction.rowCount !== 1) {
    throw new Error("Class permission function is not applied");
  }

  const integrityObjects = await db.query(`
    SELECT
      to_regclass('public.students_institution_admission_no_key') IS NOT NULL AS admission_index,
      to_regclass('public.invitations_pending_email_key') IS NOT NULL AS invitation_index,
      EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'classes_academic_consistency' AND NOT tgisinternal
      ) AS class_trigger,
      EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'timetable_slots_scope_collision' AND NOT tgisinternal
      ) AS timetable_trigger
  `);
  const integrity = integrityObjects.rows[0];
  if (!integrity.admission_index || !integrity.invitation_index || !integrity.class_trigger || !integrity.timetable_trigger) {
    throw new Error("Phase 7 data-integrity objects are not fully applied");
  }

  const communicationObjects = await db.query(`
    SELECT
      to_regclass('public.messages_provider_message_id_idx') IS NOT NULL AS provider_index,
      EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'messages'
          AND policyname = 'msg_upd'
      ) AS update_policy,
      (
        SELECT COUNT(*) = 5
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'messages'
          AND column_name = ANY(ARRAY[
            'provider',
            'providerStatusAt',
            'deliveredAt',
            'readAt',
            'failedAt'
          ])
      ) AS delivery_columns
  `);
  const communication = communicationObjects.rows[0];
  if (!communication.provider_index || !communication.update_policy || !communication.delivery_columns) {
    throw new Error("Phase 10 communications delivery objects are not fully applied");
  }

  console.log("Remediation migrations are present and RLS remains enabled.");
} finally {
  await db.end();
}
