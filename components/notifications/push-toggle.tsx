"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/provider";

type State = "loading" | "unsupported" | "not-configured" | "denied" | "default" | "granted";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      try {
        const res = await fetch("/api/push/vapid-public-key");
        const data = await res.json();
        if (!data.ok || !data.key) {
          setState("not-configured");
          return;
        }
      } catch {
        setState("not-configured");
        return;
      }
      const perm = Notification.permission;
      if (perm === "denied") setState("denied");
      else if (perm === "granted") {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "granted" : "default");
      } else setState("default");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        toast.error(t("settings", "notificationsBlocked"));
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-public-key");
      const { key } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState("granted");
      toast.success(t("settings", "notificationsEnabled"));
    } catch (e) {
      toast.error(t("common", "error"));
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
      toast.success(t("common", "saved"));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  return (
    <div className="border rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        {state === "granted" ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
        <p className="font-semibold text-sm">{t("settings", "notifications")}</p>
      </div>

      {state === "unsupported" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("settings", "notificationsNotSupported")}
        </p>
      )}
      {state === "not-configured" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("settings", "pushNotConfigured")}
        </p>
      )}
      {state === "denied" && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("settings", "notificationsBlocked")}
        </p>
      )}
      {state === "default" && (
        <button
          onClick={enable}
          disabled={busy}
          className="tap w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "…" : t("settings", "enableNotifications")}
        </button>
      )}
      {state === "granted" && (
        <button
          onClick={disable}
          disabled={busy}
          className="tap w-full border border-destructive/30 text-destructive rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "…" : t("common", "signOut")}
        </button>
      )}
    </div>
  );
}
