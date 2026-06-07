import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { getPushConfig, webpush } from "@/lib/push/config";

interface SubRow { endpoint: string; user_id: string | null; p256dh: string; auth: string; }

export async function POST(req: Request) {
  const cfg = getPushConfig();
  if (!cfg) return NextResponse.json({ ok: false, error: "Push not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const title   = body.title ?? "EduOps AI";
  const message = body.body ?? "";
  const url     = body.url ?? "/dashboard";
  const userId  = body.userId as string | undefined;

  if (process.env.PUSH_SEND_TOKEN && req.headers.get("x-push-token") !== process.env.PUSH_SEND_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let subs: SubRow[] = [];
  try {
    subs = userId
      ? await prismaAdmin.$queryRawUnsafe<SubRow[]>(`SELECT endpoint, user_id, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, userId)
      : await prismaAdmin.$queryRawUnsafe<SubRow[]>(`SELECT endpoint, user_id, p256dh, auth FROM push_subscriptions LIMIT 500`);
  } catch {
    return NextResponse.json({ ok: false, error: "No subscriptions yet" }, { status: 200 });
  }

  const payload = JSON.stringify({ title, body: message, url, tag: body.tag ?? "eduops" });
  let sent = 0;
  let removed = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await prismaAdmin.$executeRawUnsafe(`DELETE FROM push_subscriptions WHERE endpoint = $1`, s.endpoint).catch(() => {});
        removed++;
      }
    }
  }));

  return NextResponse.json({ ok: true, sent, removed, total: subs.length });
}
