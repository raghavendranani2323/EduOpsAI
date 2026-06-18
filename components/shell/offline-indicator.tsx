"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { usePendingMutationCount, useProblemMutationCount } from "@/lib/offline/use-pending-mutations";

export function OfflineIndicator() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const pending = usePendingMutationCount();
  const problems = useProblemMutationCount();

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (problems > 0) {
    return (
      <div className="sticky top-14 md:top-0 z-30 bg-red-700 text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-2" role="alert">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{problems} offline change{problems === 1 ? "" : "s"} need review. Reopen attendance before retrying.</span>
      </div>
    );
  }

  if (offline) {
    return (
      <div className="sticky top-14 md:top-0 z-30 bg-amber-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 animate-fade-in">
        <WifiOff className="h-3.5 w-3.5" />
        <span>
          {t("common", "offline")}
          {pending > 0 && (
            <span className="ml-2 opacity-90">· {pending} change{pending === 1 ? "" : "s"} queued</span>
          )}
        </span>
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div className="sticky top-14 md:top-0 z-30 bg-blue-600 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 animate-fade-in">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Syncing {pending} pending change{pending === 1 ? "" : "s"}…</span>
      </div>
    );
  }

  return null;
}
