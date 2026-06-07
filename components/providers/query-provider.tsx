"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushMutations } from "@/lib/offline/db";

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
    function onOnline() {
      flushMutations().then(({ flushed }) => {
        if (flushed > 0) toast.success(`${flushed} pending change${flushed === 1 ? "" : "s"} synced`);
        client.invalidateQueries();
      });
    }
    window.addEventListener("online", onOnline);
    if (navigator.onLine) flushMutations();
    return () => window.removeEventListener("online", onOnline);
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
