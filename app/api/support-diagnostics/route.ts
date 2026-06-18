import { NextResponse } from "next/server";
import { requireApiInstitution } from "@/lib/api/auth";
import { ApiError, errorResponse, serverErrorResponse } from "@/lib/api/errors";
import { requestIdFrom } from "@/lib/observability/request";

export async function GET(req: Request) {
  const requestId = requestIdFrom(req);
  try {
    const { institution, membership } = await requireApiInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new ApiError(403, "DIAGNOSTICS_FORBIDDEN", "Only owners and admins can view support diagnostics");
    }
    return NextResponse.json({
      ok: true,
      requestId,
      institutionId: institution.id,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      providers: {
        whatsappConfigured: Boolean(
          process.env.WHATSAPP_ACCESS_TOKEN &&
          process.env.WHATSAPP_PHONE_NUMBER_ID &&
          process.env.WHATSAPP_APP_SECRET &&
          process.env.WHATSAPP_VERIFY_TOKEN
        ),
        pushConfigured: Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        parentOtpEnabled: process.env.PARENT_OTP_ENABLED === "true",
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error, { requestId });
    return serverErrorResponse("Failed to load diagnostics", { requestId });
  }
}
