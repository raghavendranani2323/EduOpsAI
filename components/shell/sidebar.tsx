"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarCheck, IndianRupee, UserPlus,
  MessageCircle, Settings, GraduationCap, ClipboardList, BookOpen,
  Bell, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { useI18n } from "@/components/i18n/provider";

const NAV_ITEMS = [
  { href: "/dashboard",      icon: LayoutDashboard, labelKey: "dashboard"      },
  { href: "/students",       icon: Users,           labelKey: "students"       },
  { href: "/attendance",     icon: CalendarCheck,   labelKey: "attendance"     },
  { href: "/fees",           icon: IndianRupee,     labelKey: "fees"           },
  { href: "/exams",          icon: ClipboardList,   labelKey: "exams"          },
  { href: "/timetable",      icon: Calendar,        labelKey: "timetable"      },
  { href: "/homework",       icon: BookOpen,        labelKey: "homework"       },
  { href: "/notices",        icon: Bell,            labelKey: "notices"        },
  { href: "/admissions",     icon: UserPlus,        labelKey: "admissions"     },
  { href: "/communications", icon: MessageCircle,   labelKey: "communications" },
  { href: "/settings",       icon: Settings,        labelKey: "settings"       },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-border bg-[var(--surface-1)] shrink-0 h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <GraduationCap className="h-4.5 w-4.5" />
        </div>
        <span className="font-bold text-sm tracking-tight">EduOps AI</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const label = t("nav", labelKey);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/15"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
