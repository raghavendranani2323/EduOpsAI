import { NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: Request) {
  try {
    const { user, institution } = await requireInstitution();
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? "";
    const PAGE_SIZE = 50;

    const messages = await withRls(user.id, (tx) =>
      tx.message.findMany({
        where: { institutionId: institution.id },
        include: { template: { select: { kind: true } } },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    );

    const hasMore    = messages.length > PAGE_SIZE;
    const page       = hasMore ? messages.slice(0, PAGE_SIZE) : messages;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ ok: true, messages: page, nextCursor });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
}
