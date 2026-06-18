import { requireInstitution } from "@/lib/tenant/current";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";
import { InstitutionProvider } from "@/components/shell/institution-context";
import { I18nProvider } from "@/components/i18n/provider";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";
import { OfflineIndicator } from "@/components/shell/offline-indicator";
import { OfflineScopeProvider } from "@/lib/offline/scope";
import { OfflineSync } from "@/components/providers/offline-sync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { institution, user, membership } = await requireInstitution();
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <OfflineScopeProvider scope={`${institution.id}:${user.id}`}>
      <InstitutionProvider institution={institution}>
        <OfflineSync />
        <div className="flex h-full">
          <Sidebar role={membership.role} />
          <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
            <TopBar institutionName={institution.name} userEmail={user.email} role={membership.role} />
            <OfflineIndicator />
            <main id="main-content" className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-20 md:pb-0">
              {children}
            </main>
            <BottomNav role={membership.role} />
          </div>
        </div>
      </InstitutionProvider>
      </OfflineScopeProvider>
    </I18nProvider>
  );
}
