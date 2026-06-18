import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  createParentToken,
  isParentTokenActive,
  parentTokenExpiry,
} from "../lib/parent/access";
import { phoneVariants } from "../lib/parent/config";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/phase9_parent_access.sql", "utf8");
const tokenRoute = readFileSync("app/api/students/[id]/portal-token/route.ts", "utf8");
const portalPage = readFileSync("app/p/[token]/page.tsx", "utf8");
const noticePage = readFileSync("app/p/[token]/notice/[noticeId]/page.tsx", "utf8");
const children = readFileSync("lib/parent/children.ts", "utf8");
const shareButton = readFileSync("app/(app)/students/[id]/share-portal-button.tsx", "utf8");
const otpRoute = readFileSync("app/api/parent/otp/route.ts", "utf8");
const verifyRoute = readFileSync("app/api/parent/verify/route.ts", "utf8");

assert(createParentToken().length >= 40);
const now = new Date("2026-06-18T00:00:00.000Z");
assert(parentTokenExpiry(now) > now);
assert(isParentTokenActive({
  portalToken: "token",
  portalTokenExpiresAt: new Date("2026-06-19T00:00:00.000Z"),
  portalTokenRevokedAt: null,
}, now));
assert(!isParentTokenActive({
  portalToken: "token",
  portalTokenExpiresAt: new Date("2026-06-17T00:00:00.000Z"),
  portalTokenRevokedAt: null,
}, now));
assert(!isParentTokenActive({
  portalToken: "token",
  portalTokenExpiresAt: new Date("2026-06-19T00:00:00.000Z"),
  portalTokenRevokedAt: now,
}, now));
assert(phoneVariants("+919876543210").includes("9876543210"));

for (const expected of [
  "portalTokenCreatedAt",
  "portalTokenExpiresAt",
  "portalTokenRevokedAt",
  "model ParentAccessEvent",
]) assert(schema.includes(expected), `${expected} missing`);

for (const expected of [
  "CREATE TABLE IF NOT EXISTS parent_access_events",
  "parent_access_events_select",
  "30 days",
  "Rollback:",
  "Staging verification:",
]) assert(migration.includes(expected), `${expected} missing`);

assert(tokenRoute.includes('"ROTATE"'));
assert(tokenRoute.includes("parentAccess.revoke"));
assert(tokenRoute.includes("PARENT_ACCESS_FORBIDDEN"));
assert(portalPage.includes("isParentTokenActive"));
assert(portalPage.includes("InvalidParentLink"));
assert(noticePage.includes("isParentTokenActive"));
assert(children.includes('status: "ACTIVE"'));
assert(shareButton.includes("Access history"));
assert(shareButton.includes("Rotate"));
assert(shareButton.includes("Revoke"));
assert(otpRoute.includes("findChildrenForPhone"));
assert(verifyRoute.includes("PARENT_OTP_INVALID"));
assert(verifyRoute.includes("parent-otp-verify"));

console.log("Phase 4 parent access tests passed");
