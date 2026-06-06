/**
 * Admin Prisma client — connects via DIRECT_URL (postgres superuser) and
 * BYPASSES RLS. Use ONLY for trusted server-side flows that have no user
 * context:
 *   • Razorpay webhook handler
 *   • Bootstrap routes (signup → onboarding, invitation acceptance)
 *   • Migrations / seeders
 *
 * NEVER import this from React components or pages.
 * EVERY call must explicitly scope by institutionId.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForAdmin = globalThis as unknown as { prismaAdmin: PrismaClient | undefined };

function makeAdminClient(): PrismaClient {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL (or DATABASE_URL) must be set for admin client");
  const adapter = new PrismaPg({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prismaAdmin = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    if (!globalForAdmin.prismaAdmin) {
      globalForAdmin.prismaAdmin = makeAdminClient();
    }
    return globalForAdmin.prismaAdmin[prop as keyof PrismaClient];
  },
});
