import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  parseWhatsAppStatusUpdates,
  shouldApplyStatus,
  verifyWhatsAppWebhookSignature,
} from "../lib/messaging/webhook";

const provider = readFileSync("lib/messaging/provider.ts", "utf8");
const sendRoute = readFileSync("app/api/communications/send/route.ts", "utf8");
const webhookRoute = readFileSync("app/api/communications/webhook/route.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/phase10_communications_delivery.sql", "utf8");
const client = readFileSync("app/(app)/communications/communications-client.tsx", "utf8");

assert(!provider.includes("ConsoleProvider"));
assert(!provider.includes("console.log"));
assert(provider.includes("graph.facebook.com"));
assert(sendRoute.includes("COMMUNICATION_PROVIDER_NOT_CONFIGURED"));
assert(sendRoute.includes('status: "QUEUED"'));
assert(!sendRoute.includes('status: result.ok ? "SENT"'));
assert(webhookRoute.includes("x-hub-signature-256"));
assert(client.includes("queued for delivery"));

for (const expected of [
  "providerStatusAt",
  "deliveredAt",
  "readAt",
  "failedAt",
]) assert(schema.includes(expected), `${expected} missing from schema`);

for (const expected of [
  "messages_provider_message_id_idx",
  "CREATE POLICY msg_upd",
  "Legacy console delivery was not verified",
  "Rollback:",
  "Staging verification:",
]) assert(migration.includes(expected), `${expected} missing from migration`);

const payload = {
  entry: [{
    changes: [{
      value: {
        statuses: [{
          id: "wamid.test",
          status: "delivered",
          timestamp: "1781740800",
        }],
      },
    }],
  }],
};
const updates = parseWhatsAppStatusUpdates(payload);
assert.equal(updates.length, 1);
assert.equal(updates[0].providerMessageId, "wamid.test");
assert.equal(updates[0].status, "DELIVERED");
assert(shouldApplyStatus("QUEUED", "DELIVERED"));
assert(!shouldApplyStatus("READ", "DELIVERED"));
assert(!shouldApplyStatus("DELIVERED", "FAILED"));
assert(shouldApplyStatus("SENT", "FAILED"));

const previousSecret = process.env.WHATSAPP_APP_SECRET;
process.env.WHATSAPP_APP_SECRET = "test-secret";
const rawBody = JSON.stringify(payload);
const signature = createHmac("sha256", "test-secret").update(rawBody).digest("hex");
assert(verifyWhatsAppWebhookSignature(rawBody, `sha256=${signature}`));
assert(!verifyWhatsAppWebhookSignature(`${rawBody}x`, `sha256=${signature}`));
if (previousSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
else process.env.WHATSAPP_APP_SECRET = previousSecret;

console.log("Phase 4 communications tests passed");
