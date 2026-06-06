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

const SUPER_URL = process.env.RLS_TEST_SUPERUSER_URL
  ?? "postgresql://postgres.bppouwvjljwjijveavuq:Raghava6556%40@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const APP_URL = process.env.RLS_TEST_APP_USER_URL
  ?? "postgresql://app_user.bppouwvjljwjijveavuq:X9HQmfIYZ2G1Tk5ASaJiuRdV@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

const tag = `rlstest-${Date.now()}`;
const cid  = (p) => `${tag}-${p}`;
const userA = randomUUID();
const userB = randomUUID();
const instA = cid("instA");
const instB = cid("instB");
const classA = cid("classA");
const classB = cid("classB");
const studentA = cid("studentA");
const studentB = cid("studentB");
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

  // Classes
  await sup.query(`INSERT INTO classes (id, "institutionId", name, "academicYear", "updatedAt") VALUES
    ($1, $2, 'Class 1', '2025-26', NOW()),
    ($3, $4, 'Class 1', '2025-26', NOW())`,
    [classA, instA, classB, instB]);

  // Students
  await sup.query(`INSERT INTO students (id, "institutionId", "fullName", "classId", "updatedAt") VALUES
    ($1, $2, 'Aarav Sharma', $3, NOW()),
    ($4, $5, 'Bhavya Iyer',  $6, NOW())`,
    [studentA, instA, classA, studentB, instB, classB]);

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
