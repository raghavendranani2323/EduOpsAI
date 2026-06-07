import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { getPushConfig, webpush } from "@/lib/push/config";

export async function POST(req: Request) {
  const cfg = getPushConfig();
  if (!cfg) return NextResponse.json({ ok: false, error: "Push not configured" }, { status: 503 });

  if (process.env.PUSH_SEND_TOKEN && req.headers.get("x-push-token") !== process.env.PUSH_SEND_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title   = body.title ?? "EduOps AI";
  const message = body.body ?? "";
  const url     = body.url ?? "/dashboard";
  const userId  = body.userId as string | undefined;

  const subs = await prismaAdmin.pushSubscription.findMany({
    where: userId ? { userId } : {},
    take: 500,
  });

  if (subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, total: 0 });
  }

  const payload = JSON.stringify({ title, body: message, url, tag: body.tag ?? "eduops" });
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) stale.push(s.endpoint);
    }
  }));

  if (stale.length) {
    await prismaAdmin.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
  }

  return NextResponse.json({ ok: true, sent, removed: stale.length, total: subs.length });
}
