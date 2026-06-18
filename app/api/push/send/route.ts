import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { getPushConfig, webpush } from "@/lib/push/config";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { writeAuditEvent } from "@/lib/audit/server";
import {
  assertPushPayloadSize,
  assertPushSendToken,
  pushSendSchema,
  validatePushUrl,
} from "@/lib/push/send-security";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";

export async function POST(req: Request) {
  const requestId = requestIdFrom(req);
  let audit: { institutionId?: string; purpose?: string } = {};
  try {
    assertPushSendToken(req);
    const cfg = getPushConfig();
    if (!cfg) throw new ApiError(503, "PUSH_NOT_CONFIGURED", "Push notifications are not configured");

    const parsed = pushSendSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_PUSH_REQUEST", parsed.error.issues[0]?.message ?? "Invalid push request");
    }
    const body = parsed.data;
    audit = { institutionId: body.institutionId, purpose: body.purpose };
    const url = validatePushUrl(body.url);

    await enforceRateLimit({
      scope: "push-send",
      subject: body.institutionId,
      limit: 60,
      windowSeconds: 60 * 60,
    });

    const requestedUserIds = [...new Set(body.recipientUserIds)];
    const members = await prismaAdmin.membership.findMany({
      where: {
        institutionId: body.institutionId,
        revokedAt: null,
        userId: { in: requestedUserIds },
      },
      select: { userId: true },
      take: 500,
    });

    if (members.length !== requestedUserIds.length) {
      throw new ApiError(403, "PUSH_RECIPIENT_FORBIDDEN", "One or more recipients are not in this institution");
    }

    const memberUserIds = members.map((member) => member.userId);
    if (memberUserIds.length === 0) {
      await writeAuditEvent({
        actorUserId: "system:push",
        institutionId: body.institutionId,
        action: "push.send",
        outcome: "success",
        meta: { purpose: body.purpose, sent: 0, total: 0 },
      });
      return NextResponse.json({ ok: true, sent: 0, total: 0, removed: 0 });
    }

    const subs = await prismaAdmin.pushSubscription.findMany({
      where: { userId: { in: memberUserIds } },
      take: 500,
    });

    if (subs.length === 0) {
      await writeAuditEvent({
        actorUserId: "system:push",
        institutionId: body.institutionId,
        action: "push.send",
        outcome: "success",
        meta: { purpose: body.purpose, sent: 0, total: 0 },
      });
      return NextResponse.json({ ok: true, sent: 0, total: 0, removed: 0 });
    }

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url,
      tag: body.tag ?? `eduops-${body.purpose}`,
    });
    assertPushPayloadSize(payload);

    let sent = 0;
    const stale: string[] = [];

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) stale.push(s.endpoint);
        else logServer("warn", "push.send.provider_failed", {
          requestId,
          institutionId: body.institutionId,
          providerStatus: code,
        });
      }
    }));

    if (stale.length) {
      await prismaAdmin.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
    }

    await writeAuditEvent({
      actorUserId: "system:push",
      institutionId: body.institutionId,
      action: "push.send",
      outcome: "success",
      meta: { purpose: body.purpose, sent, total: subs.length, removed: stale.length },
    });

    return NextResponse.json({ ok: true, sent, removed: stale.length, total: subs.length });
  } catch (err) {
    if (err instanceof ApiError) {
      await writeAuditEvent({
        actorUserId: "system:push",
        institutionId: audit.institutionId ?? null,
        action: "push.send",
        outcome: err.status === 401 || err.status === 403 ? "denied" : "failure",
        meta: { code: err.code, purpose: audit.purpose },
      });
      return errorResponse(err, { requestId });
    }
    logServer("error", "push.send.failed", { requestId, error: err, ...audit });
    await writeAuditEvent({
      actorUserId: "system:push",
      institutionId: audit.institutionId ?? null,
      action: "push.send",
      outcome: "failure",
      meta: { purpose: audit.purpose },
    });
    return serverErrorResponse("Failed to send push notification", { requestId });
  }
}
