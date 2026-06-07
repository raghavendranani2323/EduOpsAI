import Link from "next/link";
import { Users, GraduationCap, Building2 } from "lucide-react";
import { SignOutButton } from "@/components/shell/sign-out-button";

const SETTINGS_LINKS = [
  { href: "/settings/team",       icon: Users,         label: "Team & Invitations", desc: "Invite staff and manage roles" },
  { href: "/classes",             icon: GraduationCap, label: "Classes / Batches",   desc: "Manage your classes" },
  { href: "/settings/institution",icon: Building2,     label: "Institution profile", desc: "Update institution details" },
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
            className="flex items-center gap-3 border rounded-xl p-3 hover:bg-muted transition-colors"
          >
            <Icon className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <span className="text-muted-foreground">→</span>
          </Link>
        ))}
      </div>

      <div className="pt-2">
        <SignOutButton variant="settings" />
      </div>
    </div>
  );
}
