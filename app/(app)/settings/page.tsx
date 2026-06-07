import Link from "next/link";
import { Users, GraduationCap, Building2, Bell, ChevronRight, Calendar, ShieldCheck, Download } from "lucide-react";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { PushToggle } from "@/components/notifications/push-toggle";
import { getLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

const SETTINGS_LINKS = [
  { href: "/settings/academic-year",icon: Calendar,      labelKey: "academicYear",       descKey: "academicYearDesc" },
  { href: "/settings/team",         icon: Users,         labelKey: "teamInvitations",    descKey: "teamInvitationsDesc" },
  { href: "/classes",               icon: GraduationCap, labelKey: "classesBatches",     descKey: "classesBatchesDesc" },
  { href: "/settings/institution",  icon: Building2,     labelKey: "institutionProfile", descKey: "institutionProfileDesc" },
  { href: "/settings/notifications",icon: Bell,          labelKey: "notifications",      descKey: "notificationsDesc" },
  { href: "/settings/export",       icon: Download,      labelKey: "exportData",         descKey: "exportDataDesc" },
  { href: "/settings/audit-log",    icon: ShieldCheck,   labelKey: "auditLog",           descKey: "auditLogDesc" },
] as const;

export default async function SettingsPage() {
  const messages = getMessages(await getLocale());

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">{messages.settingsPage.title}</h1>

      <div className="space-y-2">
        {SETTINGS_LINKS.map(({ href, icon: Icon, labelKey, descKey }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border rounded-xl p-3.5 hover:bg-muted transition-colors active:scale-[0.99]"
          >
            <Icon className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{messages.settingsPage[labelKey]}</p>
              <p className="text-xs text-muted-foreground">{messages.settingsPage[descKey]}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <LanguageSwitcher />
      <PushToggle />

      <div className="pt-2">
        <SignOutButton variant="settings" />
      </div>
    </div>
  );
}
