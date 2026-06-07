import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const locale = body?.locale;
  if (locale !== "en" && locale !== "te") {
    return NextResponse.json({ ok: false, error: "Invalid locale" }, { status: 400 });
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  return NextResponse.json({ ok: true });
}
