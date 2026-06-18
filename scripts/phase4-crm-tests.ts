import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  assertLeadOwner,
  findLeadDuplicateSignals,
  normalizeLeadPhone,
} from "../lib/admissions/crm";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/phase8_admissions_crm.sql", "utf8");
const leadRoute = readFileSync("app/api/leads/[id]/route.ts", "utf8");
const conversionRoute = readFileSync("app/api/leads/[id]/convert/route.ts", "utf8");
const activityRoute = readFileSync("app/api/leads/[id]/activities/route.ts", "utf8");
const client = readFileSync("app/(app)/admissions/admissions-client.tsx", "utf8");

assert.equal(normalizeLeadPhone("98765 43210"), "+919876543210");
assert.throws(() => normalizeLeadPhone("12345"), /valid Indian mobile/);

for (const expected of [
  "model LeadActivity",
  "assignedToId",
  "lostReason",
  "convertedAt",
  "LeadActivityKind",
]) {
  assert(schema.includes(expected), `${expected} missing from schema`);
}
for (const expected of [
  "CREATE TABLE IF NOT EXISTS lead_activities",
  "enforce_lead_owner_scope",
  "lead_activity_select",
  "leads_institution_owner_followup_idx",
  "Rollback:",
  "Staging verification:",
]) {
  assert(migration.includes(expected), `${expected} missing from CRM migration`);
}
assert(leadRoute.includes("LOST_REASON_REQUIRED"));
assert(leadRoute.includes("STAGE_CHANGED"));
assert(leadRoute.includes("FOLLOWUP_CHANGED"));
assert(conversionRoute.includes("EXISTING_STUDENT_MATCH"));
assert(conversionRoute.includes("LINKED_EXISTING"));
assert(activityRoute.includes('z.enum(["NOTE", "CALL", "WHATSAPP"])'));
assert(client.includes("Show overdue follow-ups"));
assert(client.includes("whatsappLink"));
assert(client.includes("Activity"));

const tx = {
  membership: {
    findFirst: async ({ where }: { where: { userId: string } }) =>
      where.userId === "owner-a" ? { id: "membership-a" } : null,
  },
  lead: {
    findMany: async () => [{ id: "lead-a", studentName: "Ravi", stage: "NEW" }],
  },
  guardian: {
    findMany: async () => [{
      students: [{
        student: { id: "student-a", fullName: "Ravi Kumar", status: "ACTIVE" },
      }],
    }],
  },
} as never;

async function main() {
  await assert.doesNotReject(assertLeadOwner(tx, "inst-a", "owner-a"));
  await assert.rejects(
    assertLeadOwner(tx, "inst-a", "owner-b"),
    (error: unknown) => error instanceof Error && error.message.includes("active owner or admin"),
  );
  const signals = await findLeadDuplicateSignals(tx, "inst-a", {
    phone: "9876543210",
    studentName: "Ravi Kumar",
  });
  assert.equal(signals.leadMatches.length, 1);
  assert.equal(signals.studentMatches.length, 1);
  assert.equal(signals.strongStudentMatch?.id, "student-a");
  console.log("Phase 4 CRM tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
