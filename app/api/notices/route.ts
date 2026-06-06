import { NextRequest, NextResponse } from "next/server";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

export async function GET(req: NextRequest) {
  try {
    const { user, institution } = await requireInstitution();

    const notices = await withRls(user.id, async (tx) => {
      return tx.notice.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: 50,
      });
    });

    return NextResponse.json({ ok: true, notices });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, institution } = await requireInstitution();
    const body = await req.json();
    const { title, body: noticeBody, audience, classId, pinned, expiresAt } = body;

    if (!title || !noticeBody) {
      return NextResponse.json({ ok: false, error: "title and body required" }, { status: 400 });
    }

    const notice = await withRls(user.id, async (tx) => {
      return tx.notice.create({
        data: {
          institutionId: institution.id,
          authorId:      user.id,
          title,
          body:          noticeBody,
          audience:      audience ?? "ALL",
          classId:       classId || null,
          pinned:        pinned ?? false,
          expiresAt:     expiresAt ? new Date(expiresAt) : null,
        },
      });
    });

    return NextResponse.json({ ok: true, notice });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to create notice" }, { status: 500 });
  }
}
