import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { ApiError } from "@/lib/api/errors";
import { requireAttendanceClassAccess } from "@/lib/attendance/access";
import { replaceAttendanceRecords } from "@/lib/attendance/save";
import { assertNoDuplicateStudentIds, parseAttendanceDate, validateAttendanceStudents } from "@/lib/attendance/validation";
import { neutralizeCsvFormula, toCSV } from "@/lib/export/csv";
import { assertPushPayloadSize, assertPushSendToken, pushSendSchema, validatePushUrl } from "@/lib/push/send-security";
import { buildHomeworkObjectKey, isHomeworkObjectKeyForInstitution, validateHomeworkFile } from "@/lib/homework/attachments";

function expectApiError(fn: () => unknown | Promise<unknown>, code: string) {
  return Promise.resolve()
    .then(fn)
    .then(
      () => assert.fail(`Expected ApiError ${code}`),
      (err) => {
        assert(err instanceof ApiError);
        assert.equal(err.code, code);
      },
    );
}

async function attendanceValidationTests() {
  assert.equal(parseAttendanceDate("2026-06-18").toISOString().slice(0, 10), "2026-06-18");
  await expectApiError(() => parseAttendanceDate("2026-13-18"), "INVALID_DATE");
  assertNoDuplicateStudentIds([{ studentId: "s1", status: "PRESENT" }]);
  await expectApiError(() => assertNoDuplicateStudentIds([
    { studentId: "s1", status: "PRESENT" },
    { studentId: "s1", status: "ABSENT" },
  ]), "DUPLICATE_STUDENT");

  const tx = {
    student: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter(id => id === "valid-active-class-student").map(id => ({ id })),
    },
  };

  await validateAttendanceStudents(tx as never, "instA", "classA", [
    { studentId: "valid-active-class-student", status: "PRESENT" },
  ]);
  await expectApiError(() => validateAttendanceStudents(tx as never, "instA", "classA", [
    { studentId: "unknown", status: "PRESENT" },
  ]), "INVALID_ATTENDANCE_STUDENTS");
  await expectApiError(() => validateAttendanceStudents(tx as never, "instA", "classA", [
    { studentId: "wrong-class", status: "PRESENT" },
  ]), "INVALID_ATTENDANCE_STUDENTS");
  await expectApiError(() => validateAttendanceStudents(tx as never, "instA", "classA", [
    { studentId: "foreign-tenant", status: "PRESENT" },
  ]), "INVALID_ATTENDANCE_STUDENTS");
  await expectApiError(() => validateAttendanceStudents(tx as never, "instA", "classA", [
    { studentId: "inactive", status: "PRESENT" },
  ]), "INVALID_ATTENDANCE_STUDENTS");
}

async function attendanceAuthorisationTests() {
  const tx = {
    class: {
      findFirst: async ({ where, select }: { where: { id?: string; institutionId?: string; sectionTeacherId?: string; classGroup?: { classHeadId?: string } }; select?: { id?: boolean } }) => {
        if (where.id === "classA" && where.institutionId === "instA") return { id: "classA" };
        if (where.sectionTeacherId === "teacherA" && where.institutionId === "instA") return { id: "classA" };
        if (where.classGroup?.classHeadId === "teacherA" && where.institutionId === "instA") return { id: "classA" };
        return select?.id ? null : null;
      },
      findMany: async ({ where }: { where: { institutionId?: string; sectionTeacherId?: string; classGroup?: { classHeadId?: string } } }) => {
        if (where.institutionId === "instA" && (where.sectionTeacherId === "teacherA" || where.classGroup?.classHeadId === "teacherA")) {
          return [{ id: "classA" }];
        }
        return [];
      },
    },
  };

  await requireAttendanceClassAccess(tx as never, "ownerA", "instA", "OWNER", "classA");
  await requireAttendanceClassAccess(tx as never, "teacherA", "instA", "TEACHER", "classA");
  await expectApiError(() => requireAttendanceClassAccess(tx as never, "teacherB", "instA", "TEACHER", "classA"), "ATTENDANCE_CLASS_FORBIDDEN");
  await expectApiError(() => requireAttendanceClassAccess(tx as never, "accountantA", "instA", "ACCOUNTANT", "classA"), "ATTENDANCE_FORBIDDEN");
  await expectApiError(() => requireAttendanceClassAccess(tx as never, "ownerA", "instB", "OWNER", "classA"), "CLASS_NOT_FOUND");
}

async function attendanceReplacementTests() {
  let deleteCalls = 0;
  const invalidTx = {
    student: { findMany: async () => [] },
    attendanceSession: { upsert: async () => assert.fail("session must not be changed before validation") },
    attendanceRecord: {
      deleteMany: async () => { deleteCalls++; },
      createMany: async () => assert.fail("records must not be inserted after validation failure"),
    },
  };
  await expectApiError(() => replaceAttendanceRecords(invalidTx as never, {
    institutionId: "instA",
    classId: "classA",
    sessionDate: new Date("2026-06-18T00:00:00.000Z"),
    sessionLabel: "morning",
    markedBy: "ownerA",
    records: [{ studentId: "invalid", status: "PRESENT" }],
  }), "INVALID_ATTENDANCE_STUDENTS");
  assert.equal(deleteCalls, 0);

  let createCalls = 0;
  const validTx = {
    student: { findMany: async () => [{ id: "studentA" }] },
    attendanceSession: { upsert: async () => ({ id: "sessionA" }) },
    attendanceRecord: {
      deleteMany: async () => { deleteCalls++; return { count: 1 }; },
      createMany: async () => { createCalls++; return { count: 1 }; },
    },
  };
  await replaceAttendanceRecords(validTx as never, {
    institutionId: "instA",
    classId: "classA",
    sessionDate: new Date("2026-06-18T00:00:00.000Z"),
    sessionLabel: "morning",
    markedBy: "ownerA",
    records: [{ studentId: "studentA", status: "PRESENT" }],
  });
  assert.equal(deleteCalls, 1);
  assert.equal(createCalls, 1);
}

function csvTests() {
  const dangerous = ["=1+1", "+911234567890", "-10", "@cmd", "\t=SUM(A1:A2)", "\r=1+1", "  =1+1"];
  for (const value of dangerous) {
    assert(neutralizeCsvFormula(value).startsWith("'"), value);
  }
  assert.equal(neutralizeCsvFormula("Aarav"), "Aarav");
  const csv = toCSV([{ Name: "=HYPERLINK(\"x\")", Note: "hello, world" }]);
  assert(csv.includes("'=HYPERLINK"));
  assert(csv.includes('"hello, world"'));
  const imported = toCSV([{
    Student: "=cmd",
    Guardian: "@malicious",
    Phone: "+911234567890",
    Notes: "\t=SUM(A1:A2)",
  }]);
  assert(imported.includes("'=cmd"));
  assert(imported.includes("'@malicious"));
  assert(imported.includes("'+911234567890"));
}

function pushTests() {
  const original = process.env.PUSH_SEND_TOKEN;
  delete process.env.PUSH_SEND_TOKEN;
  assert.throws(() => assertPushSendToken(new Request("http://local/api/push/send", { method: "POST" })), ApiError);
  process.env.PUSH_SEND_TOKEN = "secret";
  assert.throws(() => assertPushSendToken(new Request("http://local/api/push/send", { method: "POST" })), ApiError);
  assertPushSendToken(new Request("http://local/api/push/send", { method: "POST", headers: { "x-push-token": "secret" } }));
  assertPushSendToken(new Request("http://local/api/push/send", { method: "POST", headers: { authorization: "Bearer secret" } }));
  assert.equal(validatePushUrl("/dashboard"), "/dashboard");
  assert.throws(() => validatePushUrl("https://evil.test"), ApiError);
  assert.throws(() => validatePushUrl("//evil.test"), ApiError);
  assert.doesNotThrow(() => assertPushPayloadSize(JSON.stringify({ title: "A", body: "B", url: "/" })));
  assert.throws(() => assertPushPayloadSize("x".repeat(3000)), ApiError);
  assert(!pushSendSchema.safeParse({
    institutionId: "instA",
    purpose: "notice",
    title: "Notice",
    body: "Body",
    url: "/notices",
  }).success);
  assert(pushSendSchema.safeParse({
    institutionId: "instA",
    purpose: "notice",
    title: "Notice",
    body: "Body",
    url: "/notices",
    recipientUserIds: ["userA"],
  }).success);
  if (original === undefined) delete process.env.PUSH_SEND_TOKEN;
  else process.env.PUSH_SEND_TOKEN = original;
}

async function homeworkTests() {
  const key = buildHomeworkObjectKey("instA", "classA", "userA", "pdf");
  assert(isHomeworkObjectKeyForInstitution(key, "instA"));
  assert(!isHomeworkObjectKeyForInstitution(key, "instB"));
  assert(!isHomeworkObjectKeyForInstitution("instA/../x.pdf", "instA"));

  const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "homework.pdf", { type: "application/pdf" });
  const valid = await validateHomeworkFile(pdf);
  assert.equal(valid.ext, "pdf");

  const html = new File([new TextEncoder().encode("<script>alert(1)</script>")], "homework.html", { type: "text/html" });
  await expectApiError(() => validateHomeworkFile(html), "UNSUPPORTED_FILE_TYPE");

  const mismatched = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "homework.png", { type: "image/png" });
  await expectApiError(() => validateHomeworkFile(mismatched), "FILE_SIGNATURE_MISMATCH");

  const fakeWebp = new File([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])], "homework.webp", { type: "image/webp" });
  await expectApiError(() => validateHomeworkFile(fakeWebp), "FILE_SIGNATURE_MISMATCH");
}

function staffPlaintextTests() {
  const direct = readFileSync("app/api/staff/direct/route.ts", "utf8");
  const reset = readFileSync("app/api/staff/[id]/reset-password/route.ts", "utf8");
  const accept = readFileSync("app/api/invitations/accept/route.ts", "utf8");
  assert(!direct.includes("password,"));
  assert(!direct.includes("password:"));
  assert(!direct.includes("createUser"));
  assert(!direct.includes("updateUserById"));
  assert(!reset.includes("password,"));
  assert(!reset.includes("password:"));
  assert(!reset.includes("whatsappShare"));
  assert(accept.includes("updateMany"));
  assert(!accept.includes("This invitation is for"));
}

async function main() {
  await attendanceValidationTests();
  await attendanceAuthorisationTests();
  await attendanceReplacementTests();
  csvTests();
  pushTests();
  await homeworkTests();
  staffPlaintextTests();
  console.log("Phase 1 focused security tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
