import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { getMessageProvider } from "@/lib/messaging/provider";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";
import { writeAuditEvent } from "@/lib/audit/server";

const sendSchema = z.object({
  templateId: z.string().min(1).max(191),
  recipientPhones: z.array(z.string().regex(/^\+91\d{10}$/)).min(1).max(200),
  variables: z.record(z.string(), z.string().max(500)).optional(),
});

export async function POST(req: Request) {
  const requestId = requestIdFrom(req);
  let audit: { userId: string; institutionId: string } | null = null;
  try {
    const { user, institution, membership } = await requireApiInstitution();
    audit = { userId: user.id, institutionId: institution.id };
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new ApiError(403, "COMMUNICATION_SEND_FORBIDDEN", "Only owners and admins can send bulk communications");
    }
    await enforceRateLimit({
      scope: "communication-send",
      subject: `${institution.id}:${user.id}`,
      limit: 10,
      windowSeconds: 15 * 60,
    });
    const parsed = sendSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_COMMUNICATION", parsed.error.issues[0]?.message ?? "Invalid communication");
    }

    const provider = getMessageProvider();
    if (!provider) {
      throw new ApiError(
        503,
        "COMMUNICATION_PROVIDER_NOT_CONFIGURED",
        "WhatsApp delivery is not configured",
      );
    }

    const { templateId, recipientPhones } = parsed.data;
    const queuedMessages = await withRls(user.id, async (tx) => {
      const template = await tx.messageTemplate.findFirst({
        where: { id: templateId, institutionId: institution.id },
      });
      if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Message template not found");

      const vars = parsed.data.variables ?? {};
      const messageBody = template.body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
      const messages: Array<{ id: string; phone: string; body: string }> = [];

      for (const phone of recipientPhones) {
        const message = await tx.message.create({
          data: {
            institutionId: institution.id,
            recipientPhone: phone,
            channel: "WHATSAPP",
            templateId,
            body: messageBody,
            status: "QUEUED",
            provider: provider.name,
          },
          select: { id: true },
        });
        messages.push({ id: message.id, phone, body: messageBody });
      }
      return messages;
    });

    const deliveryResults: Array<{
      id: string;
      accepted: boolean;
      providerId?: string;
      errorCode?: string;
      errorMessage?: string;
    }> = [];

    for (const message of queuedMessages) {
      try {
        const result = await provider.send({
          to: message.phone,
          body: message.body,
          channel: "whatsapp",
        });
        deliveryResults.push({ id: message.id, ...result });
      } catch (error) {
        deliveryResults.push({
          id: message.id,
          accepted: false,
          errorCode: error instanceof DOMException && error.name === "TimeoutError"
            ? "PROVIDER_TIMEOUT"
            : "PROVIDER_UNAVAILABLE",
          errorMessage: "WhatsApp delivery could not be started",
        });
      }
    }

    await withRls(user.id, async (tx) => {
      for (const result of deliveryResults) {
        await tx.message.updateMany({
          where: { id: result.id, institutionId: institution.id, status: "QUEUED" },
          data: result.accepted
            ? {
                providerMessageId: result.providerId,
                providerStatusAt: new Date(),
              }
            : {
                status: "FAILED",
                failedAt: new Date(),
                providerStatusAt: new Date(),
                failureReason: result.errorCode
                  ? `${result.errorMessage ?? "Provider failure"} (${result.errorCode})`
                  : result.errorMessage ?? "Provider failure",
              },
        });
      }
    });

    const results = {
      queued: deliveryResults.filter((result) => result.accepted).length,
      failed: deliveryResults.filter((result) => !result.accepted).length,
    };
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "communications.send",
      outcome: results.failed ? "failure" : "success",
      meta: { requested: recipientPhones.length, queued: results.queued, failed: results.failed },
    });
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, { requestId });
    logServer("error", "communications.send.failed", { requestId, error: err, ...audit });
    return serverErrorResponse("Failed to send communications", { requestId });
  }
}
