"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LazyMotion, domMax, m, LayoutGroup } from "framer-motion";
import { LayoutDashboard, Layers, CalendarCheck, IndianRupee, BookOpen, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/provider";

const ADMIN_ITEMS = [
  { href: "/dashboard",    icon: LayoutDashboard, labelKey: "home"     },
  { href: "/classes",      icon: Layers,           labelKey: "classes"  },
  { href: "/attendance",   icon: CalendarCheck,    labelKey: "mark"     },
  { href: "/fees",         icon: IndianRupee,      labelKey: "fees"     },
  { href: "/more",         icon: MoreHorizontal,   labelKey: "more"     },
] as const;

// Teachers get Homework where admins get Fees
const TEACHER_ITEMS = [
  { href: "/dashboard",    icon: LayoutDashboard, labelKey: "home"     },
  { href: "/classes",      icon: Layers,           labelKey: "classes"  },
  { href: "/attendance",   icon: CalendarCheck,    labelKey: "mark"     },
  { href: "/homework",     icon: BookOpen,         labelKey: "homework" },
  { href: "/more",         icon: MoreHorizontal,   labelKey: "more"     },
] as const;

// Routes with their own fixed bottom action bar — hide the nav so the
// primary action (e.g. attendance Submit) is never covered.
const FULLSCREEN_TASK_ROUTES = [/^\/attendance\/[^/]+/];

export function BottomNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const NAV_ITEMS = role === "TEACHER" ? TEACHER_ITEMS : ADMIN_ITEMS;

  if (FULLSCREEN_TASK_ROUTES.some(r => r.test(pathname))) return null;

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 md:hidden",
        "bg-card dark:bg-[var(--surface-2)]",
        "border-t border-border",
        "shadow-[0_-8px_24px_-12px_oklch(25%_0.03_175_/_0.25)]",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <LazyMotion features={domMax} strict>
        <LayoutGroup id="bottom-nav">
          <div className="flex items-stretch px-1">
            {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              const label = t("nav", labelKey);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 min-w-0 select-none active:opacity-80 transition-opacity"
                >
                  <span className="relative flex h-8 w-14 items-center justify-center">
                    {active && (
                      <m.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full bg-primary shadow-sm"
                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "relative h-[21px] w-[21px] transition-colors duration-200",
                        active ? "text-primary-foreground" : "text-muted-foreground",
                      )}
                      strokeWidth={active ? 2.4 : 1.9}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[10.5px] leading-none tracking-wide truncate max-w-full transition-colors duration-200",
                      active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
      </LazyMotion>
    </nav>
  );
}
