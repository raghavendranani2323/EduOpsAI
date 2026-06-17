import { readFile } from "node:fs/promises";
import { Client } from "pg";

const attendancePath = "prisma/migrations/phase4_attendance_integrity.sql";
const invitationsPath = "prisma/migrations/phase4_secure_staff_invitations.sql";
const foundationsPath = "prisma/migrations/phase5_api_foundations.sql";
const permissionsPath = "prisma/migrations/phase6_permission_hardening.sql";

const [attendanceSql, invitationsSql, foundationsSql, permissionsSql] = await Promise.all([
  readFile(attendancePath, "utf8"),
  readFile(invitationsPath, "utf8"),
  readFile(foundationsPath, "utf8"),
  readFile(permissionsPath, "utf8"),
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

const url = process.env.RLS_TEST_SUPERUSER_URL;
if (!url) {
  console.log("Phase 1 migration SQL passed static verification.");
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

  console.log("Security migrations are present and RLS remains enabled.");
} finally {
  await db.end();
}
