import { prismaAdmin } from "@/lib/prisma/admin";
import type { Prisma } from "@prisma/client";

/**
 * Generate a sensible default academic year name based on current IST date.
 * India's academic year typically runs April-March, so:
 *   - Jan-Mar  → previous-year-current (e.g. "2025-26" in Feb 2026)
 *   - Apr-Dec  → current-next         (e.g. "2026-27" in Aug 2026)
 */
export function defaultAcademicYearName(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const month = ist.getUTCMonth(); // 0-11
  const year  = ist.getUTCFullYear();
  const start = month >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** Return the currently-active academic year for an institution, or null. */
export async function getActiveAcademicYear(institutionId: string) {
  return prismaAdmin.academicYear.findFirst({
    where: { institutionId, isActive: true },
  });
}

/**
 * Get the active academic year for an institution. If none is active but at
 * least one exists, activate the most recent one. If none exists, create one
 * with the default name and mark it active. Idempotent and tenant-safe.
 */
export async function getOrCreateActiveAcademicYear(institutionId: string) {
  const existing = await getActiveAcademicYear(institutionId);
  if (existing) return existing;

  // Try to activate the most recent inactive one
  const mostRecent = await prismaAdmin.academicYear.findFirst({
    where: { institutionId },
    orderBy: { name: "desc" },
  });
  if (mostRecent) {
    await prismaAdmin.academicYear.update({
      where: { id: mostRecent.id },
      data: { isActive: true },
    });
    return { ...mostRecent, isActive: true };
  }

  // Create the first one
  return prismaAdmin.academicYear.create({
    data: {
      institutionId,
      name: defaultAcademicYearName(),
      isActive: true,
    },
  });
}

/**
 * Resolve an AcademicYear inside a transaction by id-or-name. Validates the
 * year belongs to the given institution. Used by class/section creation so
 * forms can send either form during the migration period.
 */
export async function resolveAcademicYearTx(
  tx: Prisma.TransactionClient,
  institutionId: string,
  opts: { academicYearId?: string | null; academicYear?: string | null },
) {
  if (opts.academicYearId) {
    const found = await tx.academicYear.findFirst({
      where: { id: opts.academicYearId, institutionId },
    });
    if (!found) throw new Error("Academic year not found in this institution");
    return found;
  }
  const name = opts.academicYear?.trim();
  if (name) {
    return tx.academicYear.upsert({
      where: { institutionId_name: { institutionId, name } },
      create: { institutionId, name },
      update: {},
    });
  }
  // Fall back to currently-active
  const active = await tx.academicYear.findFirst({
    where: { institutionId, isActive: true },
  });
  if (active) return active;

  // Last-resort: create the default
  return tx.academicYear.create({
    data: {
      institutionId,
      name: defaultAcademicYearName(),
      isActive: true,
    },
  });
}

/** Atomically activate one year and deactivate all others for the institution. */
export async function activateAcademicYear(institutionId: string, yearId: string) {
  return prismaAdmin.$transaction([
    prismaAdmin.academicYear.updateMany({
      where: { institutionId, NOT: { id: yearId } },
      data: { isActive: false },
    }),
    prismaAdmin.academicYear.update({
      where: { id: yearId },
      data: { isActive: true },
    }),
  ]);
}
