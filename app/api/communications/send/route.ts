import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiInstitution } from "@/lib/api/auth";
import { withRls } from "@/lib/prisma/rls";
import { messageProvider } from "@/lib/messaging/provider";
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

// POST — send a message (or batch) using a template
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
    const body = parsed.data;
    const { templateId, recipientPhones } = body;

    const results = await withRls(user.id, async (tx) => {
      const template = await tx.messageTemplate.findFirst({
        where: { id: templateId, institutionId: institution.id },
      });
      if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Message template not found");

      const vars = body.variables ?? {};
      const messageBody = template.body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

      let sent = 0, failed = 0;

      for (const phone of recipientPhones) {
        const result = await messageProvider.send({ to: phone, body: messageBody, channel: "whatsapp" });

        await tx.message.create({
          data: {
            institutionId:    institution.id,
            recipientPhone:   phone,
            channel:          "WHATSAPP",
            templateId,
            body:             messageBody,
            status:           result.ok ? "SENT" : "FAILED",
            providerMessageId: result.providerId ?? null,
            sentAt:           result.ok ? new Date() : null,
            failureReason:    result.error ?? null,
          },
        });

        if (result.ok) sent++; else failed++;
      }

      return { sent, failed };
    });

    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "communications.send",
      outcome: results.failed ? "failure" : "success",
      meta: { requested: recipientPhones.length, sent: results.sent, failed: results.failed },
    });
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, { requestId });
    logServer("error", "communications.send.failed", { requestId, error: err, ...audit });
    return serverErrorResponse("Failed to send communications", { requestId });
  }
}
