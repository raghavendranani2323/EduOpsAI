"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/provider";

interface SignOutButtonProps {
  className?: string;
  variant?: "sidebar" | "settings";
}

export function SignOutButton({ className, variant = "sidebar" }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (variant === "settings") {
    return (
      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className={cn(
          "flex w-full items-center gap-3 border rounded-xl p-3 text-left hover:bg-muted transition-colors disabled:opacity-60",
          className
        )}
      >
        <LogOut className="h-5 w-5 text-primary" />
        <span className="flex-1">
          <span className="block font-medium text-sm">{t("common", "signOut")}</span>
          <span className="block text-xs text-muted-foreground">{t("settingsPage", "signOutDesc")}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-ink-foreground/55 hover:bg-white/5 hover:text-ink-foreground transition-colors disabled:opacity-60 active:scale-[0.98]",
        className
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
      {loading ? `${t("common", "signOut")}...` : t("common", "signOut")}
    </button>
  );
}
