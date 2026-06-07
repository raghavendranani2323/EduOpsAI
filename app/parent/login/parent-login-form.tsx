"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, KeyRound, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/components/i18n/provider";
import { normalizeIndianPhone } from "@/lib/parent/config";

type Step = "phone" | "otp";

export function ParentLoginForm({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep]   = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp]     = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{t("parent", "phoneAuthDisabled")}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Your school usually shares a private portal link on WhatsApp. Open that link to view your child&apos;s details.
        </p>
      </div>
    );
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeIndianPhone(phone);
    if (!normalized) { setError("Enter a valid 10-digit mobile number"); return; }
    setBusy(true);
    const res = await fetch("/api/parent/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { setError(data.error ?? "Could not send OTP"); return; }
    setPhone(normalized);
    setStep("otp");
    toast.success(t("parent", "otpSent", { phone: normalized }));
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.length < 4) { setError("Enter the OTP"); return; }
    setBusy(true);
    const res = await fetch("/api/parent/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, token: otp }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { setError(data.error ?? t("parent", "invalidOtp")); return; }
    toast.success(t("common", "signIn"));
    router.replace("/parent");
    router.refresh();
  }

  return step === "phone" ? (
    <form onSubmit={sendOtp} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t("parent", "enterPhone")}</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="9876543210"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="pl-9"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">+91 will be added automatically.</p>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button type="submit" disabled={busy} size="lg" className="w-full">
        {busy ? "…" : t("parent", "sendOtp")}
      </Button>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-4">
      <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(null); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> {t("common", "back")}
      </button>
      <div className="space-y-1.5">
        <Label htmlFor="otp">{t("parent", "enterOtp")}</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
            className="pl-9 tracking-widest text-lg"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">Sent to {phone}</p>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button type="submit" disabled={busy} size="lg" className="w-full">
        {busy ? "…" : t("parent", "verifyOtp")}
      </Button>
    </form>
  );
}
