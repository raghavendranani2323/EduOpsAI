"use client";

import { createContext, useContext } from "react";

const OfflineScopeContext = createContext<string | null>(null);

export function OfflineScopeProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  return (
    <OfflineScopeContext.Provider value={scope}>
      {children}
    </OfflineScopeContext.Provider>
  );
}

export function useOfflineScope(): string {
  const scope = useContext(OfflineScopeContext);
  if (!scope) throw new Error("Offline scope is unavailable");
  return scope;
}
