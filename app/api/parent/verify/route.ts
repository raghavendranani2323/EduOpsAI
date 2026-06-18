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
    const token = (body.token ?? "").toString().trim();
    if (!phone || !/^\d{6}$/.test(token)) {
      throw new ApiError(400, "INVALID_PARENT_OTP", "Enter the six-digit OTP");
    }
    await enforceRateLimit({
      scope: "parent-otp-verify",
      subject: phone,
      limit: 10,
      windowSeconds: 15 * 60,
    });
    const children = await findChildrenForPhone(phone);
    if (children.length === 0) {
      throw new ApiError(401, "PARENT_OTP_INVALID", "OTP is invalid or expired");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error || !data.session) {
      logServer("warn", "parent.otp.verify_rejected", { requestId, providerStatus: error?.status });
      throw new ApiError(401, "PARENT_OTP_INVALID", "OTP is invalid or expired");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, { requestId });
    logServer("error", "parent.otp.verify_failed", { requestId, error: err });
    return serverErrorResponse("Could not verify OTP", { requestId });
  }
}
