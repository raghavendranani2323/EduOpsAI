import { prismaAdmin } from "@/lib/prisma/admin";

interface AuditEvent {
  actorUserId: string;
  institutionId?: string | null;
  action: string;
  targetId?: string | null;
  outcome: "success" | "denied" | "failure";
  meta?: Record<string, unknown>;
}

export async function writeAuditEvent(event: AuditEvent) {
  try {
    await prismaAdmin.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        institutionId: event.institutionId ?? null,
        action: event.action,
        targetId: event.targetId ?? null,
        meta: {
          outcome: event.outcome,
          ...(event.meta ?? {}),
        },
      },
    });
  } catch (err) {
    console.error("[audit] write failed", {
      action: event.action,
      institutionId: event.institutionId,
      outcome: event.outcome,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

