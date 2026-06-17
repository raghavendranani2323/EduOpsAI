import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";

async function errorEnvelopeTests() {
  const response = errorResponse(
    new ApiError(429, "RATE_LIMITED", "Too many requests", 30),
    { requestId: "request-12345678" },
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.equal(response.headers.get("x-request-id"), "request-12345678");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Too many requests",
    code: "RATE_LIMITED",
    requestId: "request-12345678",
  });

  const serverError = serverErrorResponse("Failed", { requestId: "request-87654321" });
  assert.equal(serverError.status, 500);
  assert.equal((await serverError.json()).code, "INTERNAL_ERROR");
}

function requestIdTests() {
  const supplied = requestIdFrom(new Request("http://local", {
    headers: { "x-request-id": "trusted-format-123" },
  }));
  assert.equal(supplied, "trusted-format-123");
  assert.notEqual(requestIdFrom(new Request("http://local", {
    headers: { "x-request-id": "bad id with spaces" },
  })), "bad id with spaces");
}

function loggingRedactionTests() {
  const original = console.info;
  let captured = "";
  console.info = (value?: unknown) => { captured = String(value); };
  try {
    logServer("info", "test.event", {
      authorization: "Bearer secret",
      phone: "+919999999999",
      requestId: "request-12345678",
    });
  } finally {
    console.info = original;
  }
  assert(!captured.includes("Bearer secret"));
  assert(!captured.includes("+919999999999"));
  assert(captured.includes("[REDACTED]"));
  assert(captured.includes("[MINIMIZED]"));
}

function staticFoundationTests() {
  const config = readFileSync("next.config.ts", "utf8");
  for (const header of [
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
  ]) {
    assert(config.includes(header), `${header} missing`);
  }

  const migration = readFileSync("prisma/migrations/phase5_api_foundations.sql", "utf8");
  assert(migration.includes("rate_limit_counters"));
  assert(migration.includes("ENABLE ROW LEVEL SECURITY"));
  assert(migration.includes("REVOKE ALL"));

  for (const file of [
    "app/api/parent/otp/route.ts",
    "app/api/students/import/route.ts",
    "app/api/communications/send/route.ts",
    "app/api/fees/reminders/route.ts",
    "app/api/homework/upload/route.ts",
    "app/api/push/send/route.ts",
    "app/api/invitations/route.ts",
  ]) {
    assert(readFileSync(file, "utf8").includes("enforceRateLimit"), `${file} is not rate limited`);
  }
}

async function main() {
  await errorEnvelopeTests();
  requestIdTests();
  loggingRedactionTests();
  staticFoundationTests();
  console.log("API foundation tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
