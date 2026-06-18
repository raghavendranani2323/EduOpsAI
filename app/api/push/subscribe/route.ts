import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { getPushConfig } from "@/lib/push/config";

export async function POST(req: Request) {
  if (!getPushConfig()) {
    return NextResponse.json({ ok: false, error: "Push not configured" }, { status: 503 });
  }
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in before enabling notifications" }, { status: 401 });
  }
  const ua = req.headers.get("user-agent") ?? null;

  try {
    await prismaAdmin.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        endpoint: sub.endpoint,
        userId:   user.id,
        p256dh:   sub.keys.p256dh,
        auth:     sub.keys.auth,
        ua,
      },
      update: {
        userId: user.id,
        p256dh: sub.keys.p256dh,
        auth:   sub.keys.auth,
        ua,
      },
    });
  } catch (err) {
    console.error("[push/subscribe] DB write failed", err);
    return NextResponse.json({ ok: false, error: "Storage unavailable" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await prismaAdmin.pushSubscription.delete({ where: { endpoint: body.endpoint } });
  } catch { /* may not exist */ }
  return NextResponse.json({ ok: true });
}
