import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isParentOtpEnabled, normalizeIndianPhone } from "@/lib/parent/config";

export async function POST(req: Request) {
  if (!isParentOtpEnabled()) {
    return NextResponse.json({ ok: false, error: "OTP login not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const phone = normalizeIndianPhone(body.phone ?? "");
  if (!phone) return NextResponse.json({ ok: false, error: "Invalid phone number" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, phone });
}
