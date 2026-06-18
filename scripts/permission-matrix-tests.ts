import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const protectedRoutes = [
  "app/api/classes/route.ts",
  "app/api/classes/[id]/route.ts",
  "app/api/students/route.ts",
  "app/api/students/[id]/route.ts",
  "app/api/subjects/route.ts",
  "app/api/subjects/[id]/route.ts",
  "app/api/exams/route.ts",
  "app/api/exams/[id]/route.ts",
  "app/api/exams/[id]/results/route.ts",
  "app/api/timetable/route.ts",
  "app/api/timetable/[id]/route.ts",
  "app/api/notices/route.ts",
  "app/api/notices/[id]/route.ts",
  "app/api/homework/route.ts",
  "app/api/homework/[id]/route.ts",
  "app/api/leads/route.ts",
  "app/api/leads/[id]/route.ts",
  "app/api/leads/[id]/convert/route.ts",
];

for (const file of protectedRoutes) {
  const source = readFileSync(file, "utf8");
  assert(source.includes("requireApiInstitution"), `${file} must use API auth`);
  assert(!source.includes("String(e)"), `${file} exposes raw errors`);
}

for (const file of [
  "app/api/classes/route.ts",
  "app/api/subjects/route.ts",
  "app/api/exams/route.ts",
  "app/api/timetable/route.ts",
]) {
  assert(readFileSync(file, "utf8").includes("authorizedClassIds"), `${file} lacks teacher class scoping`);
}

const marks = readFileSync("app/api/exams/[id]/results/route.ts", "utf8");
assert(marks.includes("INVALID_EXAM_RESULT_SCOPE"));
assert(marks.includes("DUPLICATE_EXAM_RESULT"));
assert(marks.includes("MARKS_EXCEED_TOTAL"));

const migration = readFileSync("prisma/migrations/phase6_permission_hardening.sql", "utf8");
assert(migration.includes("can_access_class"));
for (const policy of ["att_sess_select", "subj_sel", "exam_sel", "exres_sel", "tt_sel", "hw_sel", "nt_sel", "nt_del"]) {
  assert(migration.includes(`CREATE POLICY ${policy}`), `${policy} missing`);
}

const matrix = readFileSync("docs/security/permission-matrix.md", "utf8");
for (const role of ["Owner", "Admin", "Teacher", "Accountant", "Parent", "Anonymous"]) {
  assert(matrix.includes(role), `${role} missing from matrix`);
}

console.log("Permission matrix tests passed");
