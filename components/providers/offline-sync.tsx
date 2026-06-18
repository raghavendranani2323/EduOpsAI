"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushMutations, getPendingCount } from "@/lib/offline/db";
import { notifyOfflineQueueChanged } from "@/lib/offline/use-pending-mutations";
import { useOfflineScope } from "@/lib/offline/scope";

export function OfflineSync() {
  const scope = useOfflineScope();
  const client = useQueryClient();

  useEffect(() => {
    let running = false;
    async function tryFlush(showToast: boolean) {
      if (running || await getPendingCount(scope) === 0) return;
      running = true;
      const result = await flushMutations(scope);
      running = false;
      notifyOfflineQueueChanged();
      if (result.flushed > 0) {
        if (showToast) toast.success(`${result.flushed} offline change${result.flushed === 1 ? "" : "s"} synced`);
        client.invalidateQueries();
      }
      if (result.conflicts > 0) {
        toast.error("Offline attendance needs review", {
          description: "The server changed before your queued update could sync.",
        });
      }
    }
    const onOnline = () => void tryFlush(true);
    window.addEventListener("online", onOnline);
    if (navigator.onLine) void tryFlush(false);
    const retry = window.setInterval(() => {
      if (navigator.onLine) void tryFlush(false);
    }, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(retry);
    };
  }, [client, scope]);

  return null;
}
