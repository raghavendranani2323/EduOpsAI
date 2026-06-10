import { prisma } from "./client";
import { Prisma } from "@prisma/client";

type PrismaTx = Prisma.TransactionClient;

/**
 * Serializes all operations on a transaction client.
 *
 * Interactive transactions run on a single pg connection; issuing concurrent
 * queries on it (e.g. Promise.all inside withRls) is deprecated in pg v8 and
 * throws in v9. Callers can keep using Promise.all — operations are queued
 * and executed one at a time under the hood.
 */
function serializeTx(tx: PrismaTx): PrismaTx {
  let chain: Promise<unknown> = Promise.resolve();

  const enqueue = (run: () => Promise<unknown>) => {
    const result = chain.then(run);
    chain = result.catch(() => {}); // keep the queue alive after failures
    return result;
  };

  const wrapModel = (model: object) =>
    new Proxy(model, {
      get(target, prop) {
        const v = Reflect.get(target, prop);
        if (typeof v !== "function") return v;
        return (...args: unknown[]) => enqueue(() => v.apply(target, args));
      },
    });

  return new Proxy(tx, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (typeof v === "function" && typeof prop === "string" && prop.startsWith("$")) {
        return (...args: unknown[]) => enqueue(() => v.apply(target, args));
      }
      if (typeof v === "object" && v !== null && typeof prop === "string" && !prop.startsWith("$")) {
        return wrapModel(v);
      }
      return v;
    },
  }) as PrismaTx;
}

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
      const stx = serializeTx(tx);
      await stx.$executeRaw(
        Prisma.sql`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`
      );
      return fn(stx);
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );
}
