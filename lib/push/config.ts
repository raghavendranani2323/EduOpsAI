import webpush from "web-push";

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let configured = false;
let cached: PushConfig | null = null;

export function getPushConfig(): PushConfig | null {
  if (cached) return cached;
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT ?? "mailto:admin@eduops.in";
  if (!publicKey || !privateKey) return null;
  cached = { publicKey, privateKey, subject };
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return cached;
}

export { webpush };
