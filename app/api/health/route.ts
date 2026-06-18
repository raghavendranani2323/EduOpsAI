import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = requestIdFrom(req);
  const startedAt = Date.now();
  try {
    await Promise.race([
      prismaAdmin.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("health timeout")), 3_000)),
    ]);
    return NextResponse.json(
      {
        ok: true,
        status: "ready",
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        requestId,
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    logServer("error", "health.database.failed", { requestId, error });
    return NextResponse.json(
      { ok: false, status: "degraded", checkedAt: new Date().toISOString(), requestId },
      { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  }
}
