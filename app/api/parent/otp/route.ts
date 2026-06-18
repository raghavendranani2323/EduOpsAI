import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isParentOtpEnabled, normalizeIndianPhone } from "@/lib/parent/config";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIdFrom } from "@/lib/observability/request";
import { logServer } from "@/lib/observability/logger";
import { findChildrenForPhone } from "@/lib/parent/children";

export async function POST(req: Request) {
  const requestId = requestIdFrom(req);
  try {
    if (!isParentOtpEnabled()) {
      throw new ApiError(503, "PARENT_OTP_NOT_CONFIGURED", "Parent OTP login is unavailable");
    }
    const body = await req.json().catch(() => ({}));
    const phone = normalizeIndianPhone(body.phone ?? "");
    if (!phone) throw new ApiError(400, "INVALID_PHONE", "Enter a valid Indian phone number");
    await enforceRateLimit({
      scope: "parent-otp",
      subject: phone,
      limit: 5,
      windowSeconds: 15 * 60,
    });
    const children = await findChildrenForPhone(phone);
    if (children.length === 0) {
      return NextResponse.json({ ok: true, message: "If the number is eligible, an OTP will arrive shortly" });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
    if (error) {
      logServer("warn", "parent.otp.provider_rejected", { requestId, providerStatus: error.status });
      throw new ApiError(502, "OTP_SEND_FAILED", "Could not send OTP. Try again shortly");
    }
    return NextResponse.json({ ok: true, message: "If the number is eligible, an OTP will arrive shortly" });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, { requestId });
    logServer("error", "parent.otp.failed", { requestId, error: err });
    return serverErrorResponse("Could not send OTP", { requestId });
  }
}
