import { I18nProvider } from "@/components/i18n/provider";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return <I18nProvider locale={locale} messages={messages}>{children}</I18nProvider>;
}
