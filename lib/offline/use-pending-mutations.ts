"use client";

import { useCallback, useEffect, useState } from "react";
import { getPendingCount, getProblemCount } from "./db";
import { useOfflineScope } from "./scope";

const REFRESH_EVENT = "eduops:offline-queue-changed";

export function notifyOfflineQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
  }
}

export function usePendingMutationCount(): number {
  const scope = useOfflineScope();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    getPendingCount(scope).then(setCount).catch(() => {});
  }, [scope]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    const onOnline = () => refresh();
    window.addEventListener(REFRESH_EVENT, onChange);
    window.addEventListener("online", onOnline);
    const interval = setInterval(refresh, 10_000);
    return () => {
      window.removeEventListener(REFRESH_EVENT, onChange);
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [refresh]);

  return count;
}

export function useProblemMutationCount(): number {
  const scope = useOfflineScope();
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    getProblemCount(scope).then(setCount).catch(() => {});
  }, [scope]);
  useEffect(() => {
    refresh();
    window.addEventListener(REFRESH_EVENT, refresh);
    return () => window.removeEventListener(REFRESH_EVENT, refresh);
  }, [refresh]);
  return count;
}
