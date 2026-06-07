import { prisma } from "./client";
import { Prisma } from "@prisma/client";

type PrismaTx = Prisma.TransactionClient;

/**
 * Wraps Prisma operations in a transaction that sets the Supabase JWT claims
 * so Postgres RLS policies (using current_user_id()) evaluate correctly.
 *
 * Usage:
 *   const students = await withRls(userId, (tx) =>
 *     tx.student.findMany({ where: { institutionId } })
 *   );
 */
export async function withRls<T>(
  userId: string,
  fn: (tx: PrismaTx) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`
      );
      return fn(tx);
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );
}
