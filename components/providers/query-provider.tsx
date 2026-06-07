"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushMutations, getPendingCount } from "@/lib/offline/db";
import { notifyOfflineQueueChanged } from "@/lib/offline/use-pending-mutations";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  React.useEffect(() => {
    async function tryFlush(showToast: boolean) {
      const before = await getPendingCount();
      if (before === 0) return;
      const { flushed, remaining } = await flushMutations();
      notifyOfflineQueueChanged();
      if (flushed > 0) {
        if (showToast) {
          toast.success(`${flushed} pending change${flushed === 1 ? "" : "s"} synced`, {
            description: remaining > 0 ? `${remaining} still queued — will retry shortly` : undefined,
          });
        }
        client.invalidateQueries();
      }
    }

    function onOnline() { tryFlush(true); }

    window.addEventListener("online", onOnline);
    if (navigator.onLine) tryFlush(false);
    // Retry every 30s while there's still stuff queued
    const retry = setInterval(() => {
      if (navigator.onLine) tryFlush(false);
    }, 30_000);

    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(retry);
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
