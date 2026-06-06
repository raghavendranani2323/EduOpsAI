// Razorpay server-side client helpers

export function getRazorpayKeys() {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set");
  return { keyId, keySecret };
}

export async function createRazorpayOrder(params: {
  amount:    number;  // paise
  currency?: string;
  receipt:   string;
  notes?:    Record<string, string>;
}) {
  const { keyId, keySecret } = getRazorpayKeys();
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount:   params.amount,
      currency: params.currency ?? "INR",
      receipt:  params.receipt,
      notes:    params.notes ?? {},
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.description ?? "Razorpay order creation failed");
  }

  return res.json() as Promise<{
    id:       string;
    amount:   number;
    currency: string;
    receipt:  string;
    status:   string;
  }>;
}

export function verifyRazorpaySignature(params: {
  orderId:   string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = getRazorpayKeys();
  const crypto = require("crypto") as typeof import("crypto");
  const body   = `${params.orderId}|${params.paymentId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
  return expected === params.signature;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is not set — refusing to process webhooks");
  }
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}
