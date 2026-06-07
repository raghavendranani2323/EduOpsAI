import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

const PAGE_SIZE = 40;

export async function GET(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "";
    const cursor = searchParams.get("cursor") ?? "";

    const { rows, nextCursor, actors } = await withRls(user.id, async (tx) => {
      const where = {
        institutionId: institution.id,
        ...(action ? { action } : {}),
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
      const profiles = await tx.profile.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, fullName: true, email: true, phone: true },
      });
      return {
        rows: page,
        nextCursor: hasMore ? page[page.length - 1].id : null,
        actors: new Map(profiles.map(p => [p.id, p])),
      };
    });

    return NextResponse.json({
      ok: true,
      entries: rows.map(e => ({
        id:          e.id,
        actorUserId: e.actorUserId,
        actorName:   actors.get(e.actorUserId)?.fullName ?? "Unknown",
        actorHint:   actors.get(e.actorUserId)?.email ?? actors.get(e.actorUserId)?.phone ?? null,
        action:      e.action,
        targetId:    e.targetId,
        meta:        e.meta,
        createdAt:   e.createdAt.toISOString(),
      })),
      nextCursor,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
