import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { CommunicationsClient } from "./communications-client";

export default async function CommunicationsPage() {
  const { user, institution } = await requireInstitution();

  const { templates, messages, classes } = await withRls(user.id, async (tx) => {
    const [templates, messages, classes] = await Promise.all([
      tx.messageTemplate.findMany({
        where: { institutionId: institution.id },
        orderBy: { createdAt: "desc" },
      }),
      tx.message.findMany({
        where: { institutionId: institution.id },
        include: { template: { select: { kind: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return {
      templates: templates.map(t => ({
        id:       t.id,
        kind:     t.kind as string,
        language: t.language,
        body:     t.body,
      })),
      messages: messages.map(m => ({
        id:             m.id,
        recipientPhone: m.recipientPhone,
        channel:        m.channel as string,
        body:           m.body,
        status:         m.status as string,
        sentAt:         m.sentAt?.toISOString().split("T")[0] ?? null,
        templateKind:   m.template?.kind as string | null ?? null,
      })),
      classes,
    };
  });

  return <CommunicationsClient templates={templates} messages={messages} classes={classes} />;
}
