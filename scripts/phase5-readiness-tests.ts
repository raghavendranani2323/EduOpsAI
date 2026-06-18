import { strict as assert } from "node:assert";
import { readFileSync, statSync } from "node:fs";

const offlineDb = readFileSync("lib/offline/db.ts", "utf8");
const attendanceRoute = readFileSync("app/api/attendance/route.ts", "utf8");
const attendanceSheet = readFileSync("app/(app)/attendance/[classId]/attendance-sheet.tsx", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const robots = readFileSync("app/robots.ts", "utf8");
const health = readFileSync("app/api/health/route.ts", "utf8");
const staffUpdate = readFileSync("app/api/staff/[id]/route.ts", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const landing = [
  readFileSync("components/landing/hero.tsx", "utf8"),
  readFileSync("components/landing/sections.tsx", "utf8"),
  readFileSync("components/landing/pricing.tsx", "utf8"),
].join("\n");
const consolidated = readFileSync("prisma/migrations/supabase_non_payment_remediation_all.sql", "utf8");

assert(offlineDb.includes("return null;"), "expired cache must be rejected");
assert(offlineDb.includes('state: "conflict"'));
assert(offlineDb.includes("clearOfflineData"));
assert(attendanceRoute.includes("ATTENDANCE_SYNC_CONFLICT"));
assert(attendanceSheet.includes("expectedUpdatedAt"));
assert(rootLayout.includes("Skip to main content"));
assert(rootLayout.includes('locale === "te" ? "te" : "en-IN"'));
assert(robots.includes('disallow: ["/api/"'));
assert(health.includes('status: "ready"'));
assert(!staffUpdate.includes("updated.error.message"));
assert(!staffUpdate.includes("Server is missing SUPABASE_SERVICE_ROLE_KEY"));
for (const publicPath of [
  'pathname === "/api/health"',
  'pathname === "/api/communications/webhook"',
  'pathname === "/privacy"',
  'pathname === "/robots.txt"',
  'pathname === "/sitemap.xml"',
]) {
  assert(proxy.includes(publicPath), `${publicPath} must remain public through the proxy`);
}
assert(!landing.includes("Razorpay"));
assert(!landing.includes("98%"));
assert(consolidated.includes("eduops_remediation_runs"));
assert(consolidated.includes("BEGIN;"));
assert(consolidated.includes("pg_advisory_xact_lock"));
assert(consolidated.includes("COMMIT;"));
assert(!consolidated.includes("CREATE INDEX CONCURRENTLY"));
assert(statSync("prisma/migrations/supabase_non_payment_remediation_all.sql").size > 40_000);

const students = Array.from({ length: 5_000 }, (_, index) => ({
  name: `Student ${String(index).padStart(4, "0")}`,
  classId: `class-${index % 40}`,
}));
const started = performance.now();
for (let iteration = 0; iteration < 100; iteration++) {
  students.filter((student) => student.classId === "class-12" && student.name.includes("2"));
}
assert(performance.now() - started < 1_000, "large-list filtering baseline exceeded 1 second");

console.log("Phase 5 readiness tests passed");
