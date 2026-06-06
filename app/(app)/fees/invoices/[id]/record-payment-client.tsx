"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IndianRupee } from "lucide-react";
import { formatINR } from "@/lib/format/currency";
import { todayIST } from "@/lib/format/date";

const schema = z.object({
  amount:      z.number().min(0.01, "Amount must be > 0"),
  mode:        z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "ONLINE"]),
  referenceNo: z.string().optional(),
  paidAt:      z.string().min(1, "Date is required"),
});
type FormData = z.infer<typeof schema>;

interface Props {
  invoiceId: string;
  remaining: number;
}

export function RecordPaymentClient({ invoiceId, remaining }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      amount:  remaining / 100,
      mode:    "CASH",
      paidAt:  todayIST(),
    },
  });

  const mode = watch("mode");
  const showRef = mode === "UPI" || mode === "BANK_TRANSFER" || mode === "CHEQUE";

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/fees/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount:      Math.round(data.amount * 100),
        mode:        data.mode,
        referenceNo: data.referenceNo?.trim() || null,
        paidAt:      data.paidAt,
      }),
    });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    router.refresh();
  }

  return (
    <section className="border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <IndianRupee className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm">Record payment</h2>
        <span className="ml-auto text-xs text-muted-foreground">Balance: {formatINR(remaining)}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              {...register("amount", { valueAsNumber: true })}
              className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.amount && <p className="text-destructive text-xs mt-1">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date *</label>
            <input
              type="date"
              {...register("paidAt")}
              className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Payment mode *</label>
          <div className="mt-1.5 flex gap-2 flex-wrap">
            {(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"] as const).map(m => (
              <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" value={m} {...register("mode")} className="accent-primary" />
                <span className="text-sm capitalize">{m.toLowerCase().replace("_", " ")}</span>
              </label>
            ))}
          </div>
        </div>

        {showRef && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Reference / UTR / Cheque no.</label>
            <input
              {...register("referenceNo")}
              placeholder="e.g. UPI ref or cheque number"
              className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-60 min-h-[48px]"
        >
          {saving ? "Recording…" : "Record payment"}
        </button>
      </form>
    </section>
  );
}
