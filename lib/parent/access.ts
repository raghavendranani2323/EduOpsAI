import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const PARENT_LINK_DAYS = 30;

export function createParentToken() {
  return randomBytes(32).toString("base64url");
}

export function parentTokenExpiry(now = new Date()) {
  return new Date(now.getTime() + PARENT_LINK_DAYS * 24 * 60 * 60 * 1000);
}

export function isParentTokenActive(
  student: {
    portalToken: string | null;
    portalTokenExpiresAt: Date | null;
    portalTokenRevokedAt: Date | null;
  },
  now = new Date(),
) {
  return Boolean(
    student.portalToken
    && !student.portalTokenRevokedAt
    && student.portalTokenExpiresAt
    && student.portalTokenExpiresAt > now,
  );
}

export async function recordParentAccessEvent(
  tx: Prisma.TransactionClient,
  data: {
    institutionId: string;
    studentId: string;
    actorUserId?: string | null;
    action: "GENERATED" | "ROTATED" | "REVOKED" | "VIEWED" | "EXPIRED" | "DENIED";
    meta?: Prisma.InputJsonValue;
  },
) {
  return tx.parentAccessEvent.create({ data });
}
