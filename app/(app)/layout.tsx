import { requireInstitution } from "@/lib/tenant/current";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";
import { InstitutionProvider } from "@/components/shell/institution-context";
import { I18nProvider } from "@/components/i18n/provider";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";
import { OfflineIndicator } from "@/components/shell/offline-indicator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { institution, user } = await requireInstitution();
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <InstitutionProvider institution={institution}>
        <div className="flex h-full">
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
            <TopBar institutionName={institution.name} userEmail={user.email} />
            <OfflineIndicator />
            <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-20 md:pb-0">
              {children}
            </main>
            <BottomNav />
          </div>
        </div>
      </InstitutionProvider>
    </I18nProvider>
  );
}
