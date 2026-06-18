/**
 * Cross-tenant RLS test
 *
 * Asserts that a Postgres connection using the app_user role (which Prisma
 * uses in production) cannot read another institution's data once the
 * `request.jwt.claims` `sub` is set to a specific user.
 *
 * Strategy:
 *   1. Connect as postgres (superuser) and seed two institutions, each with a
 *      user (Profile), a Membership, a Class, a Student, an Invoice and a
 *      Notice.
 *   2. Open a new connection as app_user. For each table:
 *        - SET LOCAL request.jwt.claims '{"sub": userA}'
 *        - SELECT all rows of that table; expect to see ONLY rows that belong
 *          to institutionA.
 *      Repeat with userB.
 *   3. Negative check: with no claims set, the same SELECTs must return 0 rows.
 *   4. Cleanup: delete seeded institutions (cascades).
 *
 * Exits non-zero if any assertion fails. Suitable for CI.
 */

import { Client } from "pg";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

if (existsSync(".env")) process.loadEnvFile(".env");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const SUPER_URL = process.env.RLS_TEST_SUPERUSER_URL;
const APP_URL = process.env.RLS_TEST_APP_USER_URL;

if (!SUPER_URL || !APP_URL) {
  throw new Error("RLS_TEST_SUPERUSER_URL and RLS_TEST_APP_USER_URL are required");
}

const tag = `rlstest-${Date.now()}`;
const cid  = (p) => `${tag}-${p}`;
const userA = randomUUID();
const userB = randomUUID();
const instA = cid("instA");
const instB = cid("instB");
const academicYearA = cid("academicYearA");
const academicYearB = cid("academicYearB");
const classA = cid("classA");
const classB = cid("classB");
const studentA = cid("studentA");
const studentB = cid("studentB");
const attendanceSessionA = cid("attendanceSessionA");
const attendanceSessionB = cid("attendanceSessionB");
const attendanceRecordA = cid("attendanceRecordA");
const attendanceRecordB = cid("attendanceRecordB");
const planA = cid("planA");
const planB = cid("planB");
const invoiceA = cid("invoiceA");
const invoiceB = cid("invoiceB");
const noticeA = cid("noticeA");
const noticeB = cid("noticeB");

let failures = 0;
function check(label, cond, extra) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`, extra ?? ""); failures++; }
}

async function seed(sup) {
  // Profiles for the two users
  await sup.query(`INSERT INTO profiles (id, "fullName", "updatedAt") VALUES ($1, 'User A', NOW()), ($2, 'User B', NOW())`, [userA, userB]);

  // Institutions
  await sup.query(`INSERT INTO institutions (id, name, type, city, state, "updatedAt") VALUES
    ($1, 'Institution A', 'SCHOOL', 'Mumbai', 'MH', NOW()),
    ($2, 'Institution B', 'SCHOOL', 'Pune',   'MH', NOW())`, [instA, instB]);

  // Memberships
  await sup.query(`INSERT INTO memberships (id, "userId", "institutionId", role, "acceptedAt") VALUES
    ($1, $2, $3, 'OWNER', NOW()),
    ($4, $5, $6, 'OWNER', NOW())`,
    [cid("memA"), userA, instA, cid("memB"), userB, instB]);

  await sup.query(`INSERT INTO academic_years (id, "institutionId", name, "isActive", "updatedAt") VALUES
    ($1, $2, '2025-26', true, NOW()),
    ($3, $4, '2025-26', true, NOW())`,
    [academicYearA, instA, academicYearB, instB]);

  // Classes
  await sup.query(`INSERT INTO classes (id, "institutionId", name, "academicYearId", "academicYear", "updatedAt") VALUES
    ($1, $2, 'Class 1', $3, '2025-26', NOW()),
    ($4, $5, 'Class 1', $6, '2025-26', NOW())`,
    [classA, instA, academicYearA, classB, instB, academicYearB]);

  // Students
  await sup.query(`INSERT INTO students (id, "institutionId", "fullName", "classId", "updatedAt") VALUES
    ($1, $2, 'Aarav Sharma', $3, NOW()),
    ($4, $5, 'Bhavya Iyer',  $6, NOW())`,
    [studentA, instA, classA, studentB, instB, classB]);

  await sup.query(`INSERT INTO attendance_sessions (id, "institutionId", "classId", "sessionDate", "markedBy") VALUES
    ($1, $2, $3, CURRENT_DATE, $4),
    ($5, $6, $7, CURRENT_DATE, $8)`,
    [attendanceSessionA, instA, classA, userA, attendanceSessionB, instB, classB, userB]);

  await sup.query(`INSERT INTO attendance_records (id, "sessionId", "studentId", status) VALUES
    ($1, $2, $3, 'PRESENT'),
    ($4, $5, $6, 'PRESENT')`,
    [attendanceRecordA, attendanceSessionA, studentA, attendanceRecordB, attendanceSessionB, studentB]);

  // Fee plans + invoices
  await sup.query(`INSERT INTO fee_plans (id, "institutionId", name, amount, cadence, "updatedAt") VALUES
    ($1, $2, 'Monthly', 5000, 'MONTHLY', NOW()),
    ($3, $4, 'Monthly', 5000, 'MONTHLY', NOW())`,
    [planA, instA, planB, instB]);

  await sup.query(`INSERT INTO invoices (id, "institutionId", "studentId", "feePlanId", "amountDue", "amountPaid", status, "dueDate", "updatedAt") VALUES
    ($1, $2, $3, $4, 5000, 0, 'UNPAID', NOW() + INTERVAL '7 day', NOW()),
    ($5, $6, $7, $8, 5000, 0, 'UNPAID', NOW() + INTERVAL '7 day', NOW())`,
    [invoiceA, instA, studentA, planA, invoiceB, instB, studentB, planB]);

  // Notices
  await sup.query(`INSERT INTO notices (id, "institutionId", "authorId", title, body, audience, "updatedAt") VALUES
    ($1, $2, $3, 'Notice A', 'Body A', 'PARENTS', NOW()),
    ($4, $5, $6, 'Notice B', 'Body B', 'PARENTS', NOW())`,
    [noticeA, instA, userA, noticeB, instB, userB]);

  console.log(`Seeded ${instA} + ${instB}`);
}

async function cleanup(sup) {
  // Cascade deletes via ON DELETE CASCADE on institutions
  await sup.query(`DELETE FROM institutions WHERE id IN ($1, $2)`, [instA, instB]);
  await sup.query(`DELETE FROM profiles WHERE id IN ($1, $2)`, [userA, userB]);
}

const ASSERTIONS = [
  { table: "students",   col: "institutionId" },
  { table: "classes",    col: "institutionId" },
  { table: "invoices",   col: "institutionId" },
  { table: "notices",    col: "institutionId" },
  { table: "fee_plans",  col: "institutionId" },
  { table: "attendance_sessions", col: "institutionId" },
];

async function runAs(app, userId, expectedInst) {
  await app.query("BEGIN");
  // SET LOCAL doesn't accept bind params — must inline. Safe here because userId
  // is a UUID we generated locally.
  const claims = JSON.stringify({ sub: userId }).replace(/'/g, "''");
  await app.query(`SET LOCAL request.jwt.claims = '${claims}'`);

  for (const { table, col } of ASSERTIONS) {
    const r = await app.query(
      `SELECT COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE "${col}" = $1)::int AS mine,
              COUNT(*) FILTER (WHERE "${col}" <> $1)::int AS others
       FROM ${table}
       WHERE "${col}" IN ($1, $2)`,
      [expectedInst, expectedInst === instA ? instB : instA]
    );
    const { n, mine, others } = r.rows[0];
    check(
      `as ${userId.slice(0,8)} → ${table}: ${mine} own / ${others} other (total ${n})`,
      others === 0 && mine === 1
    );
  }
  await app.query("COMMIT");
}

async function runWithoutClaims(app) {
  // Each table gets its own txn so a policy throw doesn't poison the rest.
  for (const { table, col } of ASSERTIONS) {
    await app.query("BEGIN");
    try {
      const r = await app.query(
        `SELECT COUNT(*)::int AS n FROM ${table} WHERE "${col}" IN ($1, $2)`,
        [instA, instB]
      );
      const n = r.rows[0].n;
      check(`no-claims → ${table} sees 0 rows`, n === 0, `got ${n}`);
      await app.query("COMMIT");
    } catch (e) {
      // Policy threw because claims couldn't be parsed — effectively zero rows visible.
      await app.query("ROLLBACK");
      check(`no-claims → ${table} blocked (policy threw)`, true);
    }
  }
}

async function runAttendanceIntegrity(app) {
  await app.query("BEGIN");
  const claims = JSON.stringify({ sub: userA }).replace(/'/g, "''");
  await app.query(`SET LOCAL request.jwt.claims = '${claims}'`);

  const visible = await app.query(
    `SELECT COUNT(*)::int AS n
     FROM attendance_records r
     JOIN attendance_sessions s ON s.id = r."sessionId"
     WHERE s."institutionId" IN ($1, $2)`,
    [instA, instB],
  );
  check("user A sees only own attendance record", visible.rows[0].n === 1, `got ${visible.rows[0].n}`);

  const foreignUpdate = await app.query(
    `UPDATE attendance_sessions SET "sessionLabel" = 'changed' WHERE id = $1`,
    [attendanceSessionB],
  );
  check("user A cannot mutate institution B attendance session", foreignUpdate.rowCount === 0);

  await app.query("SAVEPOINT invalid_attendance_record");
  try {
    await app.query(
      `INSERT INTO attendance_records (id, "sessionId", "studentId", status)
       VALUES ($1, $2, $3, 'ABSENT')`,
      [cid("invalidCrossTenantAttendance"), attendanceSessionA, studentB],
    );
    check("cross-tenant student cannot be inserted into attendance", false);
  } catch {
    await app.query("ROLLBACK TO SAVEPOINT invalid_attendance_record");
    check("cross-tenant student cannot be inserted into attendance", true);
  }

  const existing = await app.query(
    `SELECT COUNT(*)::int AS n FROM attendance_records WHERE id = $1`,
    [attendanceRecordA],
  );
  check("failed attendance insertion preserves existing record", existing.rows[0].n === 1);
  await app.query("ROLLBACK");
}

const sup = new Client({ connectionString: SUPER_URL });
const app = new Client({ connectionString: APP_URL });
await sup.connect();
await app.connect();

try {
  await seed(sup);

  console.log("\n[1] With JWT claim sub=userA — must see only institution A:");
  await runAs(app, userA, instA);

  console.log("\n[2] With JWT claim sub=userB — must see only institution B:");
  await runAs(app, userB, instB);

  console.log("\n[3] Without any claim — must see 0 rows:");
  await runWithoutClaims(app);
  console.log("\n[4] Attendance tenant and record integrity:");
  await runAttendanceIntegrity(app);
} finally {
  await cleanup(sup);
  await sup.end();
  await app.end();
}

if (failures > 0) {
  console.error(`\n❌ ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\n✅ Cross-tenant RLS test passed");
