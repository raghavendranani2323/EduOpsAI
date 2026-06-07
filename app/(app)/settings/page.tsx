import Link from "next/link";
import { Users, GraduationCap, Building2, Bell, ChevronRight, Calendar } from "lucide-react";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { PushToggle } from "@/components/notifications/push-toggle";

const SETTINGS_LINKS = [
  { href: "/settings/academic-year",icon: Calendar,      label: "Academic year",       desc: "Set the current academic year" },
  { href: "/settings/team",         icon: Users,         label: "Team & Invitations",  desc: "Invite staff and manage roles" },
  { href: "/classes",               icon: GraduationCap, label: "Classes / Batches",   desc: "Manage your classes" },
  { href: "/settings/institution",  icon: Building2,     label: "Institution profile", desc: "Update institution details" },
  { href: "/settings/notifications",icon: Bell,          label: "Notifications",       desc: "Push & WhatsApp preferences" },
];

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Settings</h1>

      <div className="space-y-2">
        {SETTINGS_LINKS.map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border rounded-xl p-3.5 hover:bg-muted transition-colors active:scale-[0.99]"
          >
            <Icon className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
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
