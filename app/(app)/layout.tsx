import { requireInstitution } from "@/lib/tenant/current";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";
import { InstitutionProvider } from "@/components/shell/institution-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { institution } = await requireInstitution();

  return (
    <InstitutionProvider institution={institution}>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <TopBar institutionName={institution.name} />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {children}
          </main>
          <BottomNav />
        </div>
      </div>
    </InstitutionProvider>
  );
}
