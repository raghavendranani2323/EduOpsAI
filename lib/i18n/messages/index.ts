import { en } from "./en";
import { te } from "./te";
import type { Messages } from "./en";

export type Locale = "en" | "te";

export const LOCALES: Array<{ code: Locale; label: string; native: string }> = [
  { code: "en", label: "English", native: "English" },
  { code: "te", label: "Telugu",  native: "తెలుగు" },
];

const DICTS: Record<Locale, Messages> = { en, te };

export function getMessages(locale: Locale): Messages {
  return DICTS[locale] ?? en;
}

export const DEFAULT_LOCALE: Locale = "en";
export type { Messages };
