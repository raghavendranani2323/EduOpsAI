import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { messageProvider } from "@/lib/messaging/provider";

// POST — send a message (or batch) using a template
export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json() as {
      templateId: string;
      recipientPhones: string[];  // array of E.164 phones
      variables?: Record<string, string>;
    };

    const { templateId, recipientPhones } = body;
    if (!templateId || !recipientPhones?.length) {
      return NextResponse.json({ ok: false, error: "templateId and recipientPhones required" }, { status: 400 });
    }

    const results = await withRls(user.id, async (tx) => {
      const template = await tx.messageTemplate.findFirst({
        where: { id: templateId, institutionId: institution.id },
      });
      if (!template) throw new Error("Template not found");

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

    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
