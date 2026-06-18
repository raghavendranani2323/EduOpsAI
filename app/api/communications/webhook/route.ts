import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { logServer } from "@/lib/observability/logger";
import {
  parseWhatsAppStatusUpdates,
  shouldApplyStatus,
  verifyWhatsAppWebhookSignature,
} from "@/lib/messaging/webhook";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const configuredToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!configuredToken) {
    return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  }
  if (mode !== "subscribe" || token !== configuredToken || !challenge) {
    return NextResponse.json({ ok: false, error: "Webhook verification failed" }, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const updates = parseWhatsAppStatusUpdates(payload);
  let applied = 0;
  for (const update of updates) {
    const message = await prismaAdmin.message.findFirst({
      where: {
        provider: "meta_whatsapp",
        providerMessageId: update.providerMessageId,
      },
      select: { id: true, status: true },
    });
    if (!message || !shouldApplyStatus(message.status, update.status)) continue;

    await prismaAdmin.message.update({
      where: { id: message.id },
      data: {
        status: update.status,
        providerStatusAt: update.occurredAt,
        ...(update.status === "SENT" ? { sentAt: update.occurredAt } : {}),
        ...(update.status === "DELIVERED" ? { deliveredAt: update.occurredAt } : {}),
        ...(update.status === "READ" ? { readAt: update.occurredAt } : {}),
        ...(update.status === "FAILED"
          ? { failedAt: update.occurredAt, failureReason: update.failureReason ?? "Provider failure" }
          : {}),
      },
    });
    applied++;
  }

  logServer("info", "communications.webhook.processed", {
    received: updates.length,
    applied,
  });
  return NextResponse.json({ ok: true, received: updates.length, applied });
}
