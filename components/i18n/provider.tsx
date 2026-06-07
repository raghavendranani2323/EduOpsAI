"use client";

import * as React from "react";
import type { Locale, Messages } from "@/lib/i18n/messages";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: <K1 extends keyof Messages, K2 extends keyof Messages[K1]>(group: K1, key: K2, vars?: Record<string, string | number>) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const value = React.useMemo<I18nContextValue>(() => ({
    locale,
    messages,
    t: (group, key, vars) => {
      const g = messages[group] as Record<string, string> | undefined;
      const raw = g?.[key as string] ?? `${String(group)}.${String(key)}`;
      return interpolate(raw, vars);
    },
  }), [locale, messages]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
