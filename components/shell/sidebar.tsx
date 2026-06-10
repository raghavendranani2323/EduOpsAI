"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LazyMotion, domAnimation, m, LayoutGroup } from "framer-motion";
import {
  LayoutDashboard, Users, CalendarCheck, IndianRupee, UserPlus,
  MessageCircle, Settings, GraduationCap, ClipboardList, BookOpen,
  Bell, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { useI18n } from "@/components/i18n/provider";

const NAV_SECTIONS = [
  {
    items: [
      { href: "/dashboard",  icon: LayoutDashboard, labelKey: "dashboard"  },
      { href: "/students",   icon: Users,           labelKey: "students"   },
      { href: "/attendance", icon: CalendarCheck,   labelKey: "attendance" },
      { href: "/fees",       icon: IndianRupee,     labelKey: "fees"       },
    ],
  },
  {
    items: [
      { href: "/exams",     icon: ClipboardList, labelKey: "exams"     },
      { href: "/timetable", icon: Calendar,      labelKey: "timetable" },
      { href: "/homework",  icon: BookOpen,      labelKey: "homework"  },
      { href: "/notices",   icon: Bell,          labelKey: "notices"   },
    ],
  },
  {
    items: [
      { href: "/admissions",     icon: UserPlus,      labelKey: "admissions"     },
      { href: "/communications", icon: MessageCircle, labelKey: "communications" },
      { href: "/settings",       icon: Settings,      labelKey: "settings"       },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden md:flex flex-col w-60 bg-ink text-ink-foreground shrink-0 h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="h-9 w-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shadow-md">
          <GraduationCap className="h-4.5 w-4.5" />
        </div>
        <div className="leading-tight">
          <span className="font-display font-semibold text-[15px] tracking-tight block">EduOps AI</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-foreground/45">Workspace</span>
        </div>
      </div>

      <LazyMotion features={domAnimation} strict>
        <LayoutGroup id="sidebar-nav">
          <nav className="flex-1 px-3 overflow-y-auto scrollbar-none">
            {NAV_SECTIONS.map((section, i) => (
              <div key={i} className={cn("space-y-0.5", i > 0 && "mt-3 pt-3 border-t border-white/8")}>
                {section.items.map(({ href, icon: Icon, labelKey }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  const label = t("nav", labelKey);
                  return (
                    <Link
                      key={href}
                      href={href}
                      prefetch
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors duration-200",
                        active
                          ? "text-white font-semibold"
                          : "text-ink-foreground/60 hover:text-ink-foreground hover:bg-white/5"
                      )}
                    >
                      {active && (
                        <m.span
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/10"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      {active && (
                        <m.span
                          layoutId="sidebar-rail"
                          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <Icon className="h-4 w-4 shrink-0 relative" strokeWidth={active ? 2.3 : 1.7} />
                      <span className="relative">{label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </LayoutGroup>
      </LazyMotion>

      <div className="p-3 border-t border-white/8">
        <SignOutButton />
      </div>
    </aside>
  );
}
