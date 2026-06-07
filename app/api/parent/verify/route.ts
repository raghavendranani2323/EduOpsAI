import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isParentOtpEnabled, normalizeIndianPhone } from "@/lib/parent/config";

export async function POST(req: Request) {
  if (!isParentOtpEnabled()) {
    return NextResponse.json({ ok: false, error: "OTP login not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const phone = normalizeIndianPhone(body.phone ?? "");
  const token = (body.token ?? "").toString().trim();
  if (!phone || !token) return NextResponse.json({ ok: false, error: "Missing phone or OTP" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error || !data.session) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Invalid OTP" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
