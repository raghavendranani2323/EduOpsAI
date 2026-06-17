import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { ApiError } from "@/lib/api/errors";

export const pushSendSchema = z.object({
  institutionId: z.string().min(1),
  purpose: z.enum(["notice", "homework", "attendance", "system"]),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().max(300).default("/dashboard"),
  tag: z.string().trim().max(64).optional(),
  recipientUserIds: z.array(z.string().min(1).max(191)).min(1).max(500),
}).strict();

export type PushSendInput = z.infer<typeof pushSendSchema>;

export function assertPushSendToken(req: Request) {
  const configuredToken = process.env.PUSH_SEND_TOKEN;
  if (!configuredToken) {
    throw new ApiError(503, "PUSH_SEND_NOT_CONFIGURED", "Push sending is not configured");
  }

  const headerToken = req.headers.get("x-push-token");
  const auth = req.headers.get("authorization");
  const bearerToken = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  const supplied = headerToken ?? bearerToken;
  const suppliedBytes = supplied ? Buffer.from(supplied) : Buffer.alloc(0);
  const configuredBytes = Buffer.from(configuredToken);
  const valid = suppliedBytes.length === configuredBytes.length
    && timingSafeEqual(suppliedBytes, configuredBytes);
  if (!valid) {
    throw new ApiError(401, "PUSH_SEND_UNAUTHORISED", "Unauthorised");
  }
}

export function validatePushUrl(url: string) {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\") || /[\u0000-\u001f]/.test(url)) {
    throw new ApiError(400, "INVALID_PUSH_URL", "Notification URL must be an internal path");
  }
  return url;
}

export function assertPushPayloadSize(payload: string) {
  if (Buffer.byteLength(payload, "utf8") > 2048) {
    throw new ApiError(400, "PUSH_PAYLOAD_TOO_LARGE", "Notification payload is too large");
  }
}
