import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { AuditLogClient } from "./audit-log-client";
import { redirect } from "next/navigation";

interface SearchParams { action?: string; cursor?: string }

const PAGE_SIZE = 40;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const filterAction = sp.action ?? "";
  const cursor = sp.cursor ?? "";

  const { entries, actors, nextCursor, distinctActions } = await withRls(user.id, async (tx) => {
    const where = {
      institutionId: institution.id,
      ...(filterAction ? { action: filterAction } : {}),
    };
    const rows = await tx.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    const actorIds = [...new Set(page.map(r => r.actorUserId))];
    const actorProfiles = await tx.profile.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true, email: true, phone: true },
    });

    // Distinct actions for the filter dropdown
    const distinctActions = await tx.auditLog.groupBy({
      by: ["action"],
      where: { institutionId: institution.id },
      _count: { _all: true },
      orderBy: { action: "asc" },
    });

    return {
      entries: page,
      actors: new Map(actorProfiles.map(a => [a.id, a])),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      distinctActions: distinctActions.map(d => ({ action: d.action, count: d._count._all })),
    };
  });

  const safeEntries = entries.map(e => ({
    id:          e.id,
    actorUserId: e.actorUserId,
    actorName:   actors.get(e.actorUserId)?.fullName ?? "Unknown",
    actorHint:   actors.get(e.actorUserId)?.email ?? actors.get(e.actorUserId)?.phone ?? null,
    action:      e.action,
    targetId:    e.targetId,
    meta:        e.meta as Record<string, unknown> | null,
    createdAt:   e.createdAt.toISOString(),
  }));

  return (
    <AuditLogClient
      entries={safeEntries}
      filterAction={filterAction}
      nextCursor={nextCursor}
      actions={distinctActions}
    />
  );
}
