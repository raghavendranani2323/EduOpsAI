import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import { getPushConfig } from "@/lib/push/config";

export async function POST(req: Request) {
  if (!getPushConfig()) {
    return NextResponse.json({ ok: false, error: "Push not configured" }, { status: 503 });
  }
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint) return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    await prismaAdmin.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
         endpoint  TEXT PRIMARY KEY,
         user_id   TEXT,
         p256dh    TEXT NOT NULL,
         auth      TEXT NOT NULL,
         "createdAt" TIMESTAMPTZ DEFAULT NOW()
       )`,
    );
    await prismaAdmin.$executeRawUnsafe(
      `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      sub.endpoint, user?.id ?? null, sub.keys?.p256dh ?? "", sub.keys?.auth ?? "",
    );
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
    await prismaAdmin.$executeRawUnsafe(
      `DELETE FROM push_subscriptions WHERE endpoint = $1`,
      body.endpoint,
    );
  } catch { /* table may not exist yet */ }
  return NextResponse.json({ ok: true });
}
