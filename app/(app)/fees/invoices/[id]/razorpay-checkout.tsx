"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { formatINR } from "@/lib/format/currency";

interface Props {
  invoiceId: string;
  remaining: number;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function RazorpayCheckout({ invoiceId, remaining }: Props) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    const loaded = await loadRazorpayScript();
    if (!loaded) { setError("Failed to load Razorpay. Check your internet connection."); setLoading(false); return; }

    const res    = await fetch(`/api/fees/invoices/${invoiceId}/create-order`, { method: "POST" });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setLoading(false); return; }

    const rzp = new window.Razorpay({
      key:         result.keyId,
      amount:      result.amount,
      currency:    "INR",
      order_id:    result.orderId,
      name:        result.institutionName,
      description: `Fee payment for ${result.studentName}`,
      prefill:     {},
      theme:       { color: "#6366f1" },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        // Verify + record on server
        const verify = await fetch(`/api/fees/invoices/${invoiceId}/verify-payment`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            orderId:   response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        });
        const vResult = await verify.json();
        if (vResult.ok) {
          router.refresh();
        } else {
          setError(vResult.error ?? "Payment verification failed");
        }
        setLoading(false);
      },
      modal: {
        ondismiss: () => setLoading(false),
      },
    });

    rzp.open();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 min-h-[48px] flex items-center justify-center gap-2"
      >
        <CreditCard className="h-4 w-4" />
        {loading ? "Opening payment…" : `Pay ${formatINR(remaining)} online`}
      </button>
      {error && <p className="text-destructive text-xs text-center">{error}</p>}
      <p className="text-xs text-muted-foreground text-center">Powered by Razorpay · UPI, Cards, Netbanking</p>
    </div>
  );
}
