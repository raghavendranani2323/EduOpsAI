import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  assertAdmissionNoAvailable,
  assertStudentClass,
  assertTimetableReferencesAndAvailability,
  normalizeAdmissionNo,
  validateTimetableRange,
} from "../lib/data-integrity/validation";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/phase7_non_payment_data_integrity.sql", "utf8");
const studentRoute = readFileSync("app/api/students/[id]/route.ts", "utf8");
const classRoute = readFileSync("app/api/classes/[id]/route.ts", "utf8");
const seed = readFileSync("prisma/seed.ts", "utf8");
const restSeed = readFileSync("prisma/seed-rest.ts", "utf8");
const rlsTest = readFileSync("scripts/rls-cross-tenant-test.mjs", "utf8");

for (const preflight of [
  "Duplicate institution admission numbers",
  "Duplicate timetable start slots",
  "Overlapping timetable slots",
  "Duplicate class sections",
  "Duplicate pending invitations",
  "Duplicate attendance records",
  "Duplicate student guardian links",
  "Duplicate notice reads",
  "Duplicate exam results",
  "Duplicate push endpoints",
  "Class academic-year mirrors are inconsistent",
  "Invalid notice read references",
  "Cross-tenant or cross-class references",
]) {
  assert(migration.includes(preflight), `${preflight} preflight missing`);
}

for (const index of [
  "students_institution_admission_no_key",
  "leads_institution_stage_followup_idx",
  "messages_institution_status_created_idx",
  "homework_institution_class_due_idx",
  "notices_institution_audience_published_idx",
  "audit_logs_institution_action_created_idx",
  "classes_group_section_key",
  "invitations_pending_email_key",
  "subjects_class_name_key",
  "exam_results_institution_student_idx",
]) {
  assert(migration.includes(index), `${index} missing`);
}

assert(migration.includes("enforce_class_academic_consistency"));
assert(migration.includes("enforce_student_class_scope"));
assert(migration.includes("enforce_student_guardian_scope"));
assert(migration.includes("enforce_attendance_scope"));
assert(migration.includes("enforce_exam_result_scope"));
assert(migration.includes("enforce_timetable_scope_and_collision"));
assert(migration.includes("enforce_direct_tenant_scope"));
assert(migration.includes("notice_reads_studentId_fkey"));
assert(migration.includes("ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY"));
assert(schema.includes("student Student @relation(fields: [studentId]"));
assert(schema.includes("@@unique([classId, dayOfWeek, startTime])"));
assert(schema.includes("@@index([institutionId, studentId])"));
assert(studentRoute.includes('status: "ARCHIVED"'));
assert(studentRoute.includes("archivedAt: new Date()"));
assert(!classRoute.includes("body.academicYear"));
assert(classRoute.includes("CLASS_HAS_HISTORY"));
assert(seed.includes("academicYearId: academicYear.id"));
assert(restSeed.includes('"academicYearId", "academicYear"'));
assert(rlsTest.includes('"academicYearId", "academicYear"'));

assert.equal(normalizeAdmissionNo("  ADM-001  "), "ADM-001");
assert.equal(normalizeAdmissionNo("   "), null);
assert.doesNotThrow(() => validateTimetableRange(1, "09:00", "09:45"));
assert.throws(
  () => validateTimetableRange(0, "09:00", "09:45"),
  (error: unknown) => error instanceof Error && error.message.includes("valid day"),
);
assert.throws(
  () => validateTimetableRange(1, "10:00", "09:45"),
  (error: unknown) => error instanceof Error && error.message.includes("valid day"),
);

const tx = {
  student: {
    findFirst: async ({ where }: { where: { admissionNo?: unknown } }) =>
      where.admissionNo ? { id: "student-existing" } : null,
  },
  class: {
    findFirst: async ({ where }: { where: { id: string } }) =>
      where.id === "class-a" ? { id: "class-a" } : null,
  },
  subject: {
    findFirst: async ({ where }: { where: { id: string } }) =>
      where.id === "subject-a" ? { id: "subject-a" } : null,
  },
  membership: {
    findFirst: async ({ where }: { where: { userId: string } }) =>
      where.userId === "teacher-a" ? { id: "membership-a" } : null,
  },
  timetableSlot: {
    findFirst: async ({ where }: { where: { startTime: { lt: string } } }) =>
      where.startTime.lt === "10:00" ? { id: "slot-existing" } : null,
  },
} as never;

async function main() {
  await assert.rejects(
    assertAdmissionNoAvailable(tx, "inst-a", "ADM-001"),
    (error: unknown) => error instanceof Error && error.message.includes("already used"),
  );
  await assert.doesNotReject(assertAdmissionNoAvailable(tx, "inst-a", null));
  await assert.doesNotReject(assertStudentClass(tx, "inst-a", "class-a"));
  await assert.rejects(
    assertStudentClass(tx, "inst-a", "class-b"),
    (error: unknown) => error instanceof Error && error.message.includes("not valid"),
  );
  await assert.rejects(
    assertTimetableReferencesAndAvailability(tx, {
      institutionId: "inst-a",
      classId: "class-a",
      subjectId: "subject-a",
      teacherId: "teacher-a",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
    }),
    (error: unknown) => error instanceof Error && error.message.includes("overlapping"),
  );

  console.log("Data integrity tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
