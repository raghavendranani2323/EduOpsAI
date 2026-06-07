import { cookies } from "next/headers";
import type { Locale } from "./messages";
import { DEFAULT_LOCALE } from "./messages";

export const LOCALE_COOKIE = "eduops_locale";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value === "en" || value === "te") return value;
  return DEFAULT_LOCALE;
}
