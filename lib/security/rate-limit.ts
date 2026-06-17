import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prismaAdmin } from "@/lib/prisma/admin";

interface RateLimitInput {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}

interface RateLimitRow {
  count: number;
  resetAt: Date;
}

function bucketId(scope: string, subject: string) {
  return createHash("sha256").update(`${scope}:${subject}`).digest("hex");
}

export async function enforceRateLimit(input: RateLimitInput) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + input.windowSeconds * 1000);
  const id = bucketId(input.scope, input.subject);

  const rows = await prismaAdmin.$queryRaw<RateLimitRow[]>(Prisma.sql`
    INSERT INTO rate_limit_counters (id, scope, count, "resetAt", "createdAt", "updatedAt")
    VALUES (${id}, ${input.scope}, 1, ${resetAt}, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      count = CASE
        WHEN rate_limit_counters."resetAt" <= ${now} THEN 1
        ELSE rate_limit_counters.count + 1
      END,
      "resetAt" = CASE
        WHEN rate_limit_counters."resetAt" <= ${now} THEN ${resetAt}
        ELSE rate_limit_counters."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING count, "resetAt"
  `);

  const row = rows[0];
  if (!row) {
    throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Please try again shortly");
  }
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(row.resetAt).getTime() - now.getTime()) / 1000),
  );
  if (row.count > input.limit) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many requests. Try again later",
      retryAfterSeconds,
    );
  }

  return {
    limit: input.limit,
    remaining: Math.max(0, input.limit - row.count),
    resetAt: new Date(row.resetAt),
  };
}
