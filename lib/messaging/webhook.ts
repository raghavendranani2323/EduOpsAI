import { createHmac, timingSafeEqual } from "node:crypto";
import type { MessageStatus } from "@prisma/client";

export interface ProviderStatusUpdate {
  providerMessageId: string;
  status: Exclude<MessageStatus, "DRAFT" | "QUEUED">;
  occurredAt: Date;
  failureReason?: string;
}

const STATUS_MAP = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
} as const;

export function verifyWhatsAppWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader.startsWith("sha256=")) return false;
  const supplied = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(supplied) || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
}

export function parseWhatsAppStatusUpdates(payload: unknown): ProviderStatusUpdate[] {
  if (!payload || typeof payload !== "object") return [];
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return [];

  const updates: ProviderStatusUpdate[] = [];
  for (const entry of entries) {
    const changes = entry && typeof entry === "object"
      ? (entry as { changes?: unknown }).changes
      : null;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = change && typeof change === "object"
        ? (change as { value?: unknown }).value
        : null;
      const statuses = value && typeof value === "object"
        ? (value as { statuses?: unknown }).statuses
        : null;
      if (!Array.isArray(statuses)) continue;

      for (const item of statuses) {
        if (!item || typeof item !== "object") continue;
        const statusItem = item as {
          id?: unknown;
          status?: unknown;
          timestamp?: unknown;
          errors?: Array<{ code?: unknown }>;
        };
        if (typeof statusItem.id !== "string" || typeof statusItem.status !== "string") continue;
        const status = STATUS_MAP[statusItem.status as keyof typeof STATUS_MAP];
        if (!status) continue;
        const seconds = typeof statusItem.timestamp === "string"
          ? Number(statusItem.timestamp)
          : Number.NaN;
        const occurredAt = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
        const providerError = statusItem.errors?.[0];
        const failureReason = status === "FAILED"
          ? `Provider failure${providerError?.code ? ` (${String(providerError.code)})` : ""}`
          : undefined;
        updates.push({
          providerMessageId: statusItem.id,
          status,
          occurredAt,
          ...(failureReason ? { failureReason } : {}),
        });
      }
    }
  }
  return updates;
}

const STATUS_RANK: Record<MessageStatus, number> = {
  DRAFT: 0,
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  FAILED: 5,
};

export function shouldApplyStatus(current: MessageStatus, incoming: ProviderStatusUpdate["status"]): boolean {
  if (current === "READ") return false;
  if (incoming === "FAILED") {
    return current !== "DELIVERED" && current !== "FAILED";
  }
  if (current === "FAILED") return false;
  return STATUS_RANK[incoming] > STATUS_RANK[current];
}
