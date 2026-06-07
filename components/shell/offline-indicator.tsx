"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";

export function OfflineIndicator() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOffline(!navigator.onLine);
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-14 md:top-0 z-30 bg-amber-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 animate-fade-in">
      <WifiOff className="h-3.5 w-3.5" />
      <span>{t("common", "offline")}</span>
    </div>
  );
}
