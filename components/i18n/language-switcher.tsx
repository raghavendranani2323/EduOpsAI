"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "./provider";
import { LOCALES, type Locale } from "@/lib/i18n/messages";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function change(next: Locale) {
    if (next === locale) return;
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    toast.success(t("common", "saved"));
    startTransition(() => router.refresh());
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-primary" />
        <p className="font-semibold text-sm">{t("settings", "language")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LOCALES.map(l => (
          <button
            key={l.code}
            onClick={() => change(l.code)}
            disabled={pending}
            className={`tap rounded-xl border p-3 text-sm transition-colors active:scale-[0.98] ${
              locale === l.code
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "hover:bg-muted"
            }`}
          >
            <div className="font-medium">{l.native}</div>
            <div className="text-xs text-muted-foreground">{l.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
