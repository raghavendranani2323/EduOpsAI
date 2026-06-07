"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup } from "framer-motion";
import { LayoutDashboard, Users, CalendarCheck, IndianRupee, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Home"     },
  { href: "/students",     icon: Users,            label: "Students" },
  { href: "/attendance",   icon: CalendarCheck,    label: "Mark"     },
  { href: "/fees",         icon: IndianRupee,      label: "Fees"     },
  { href: "/more",         icon: MoreHorizontal,   label: "More"     },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 glass border-t border-border/60 flex md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <LayoutGroup id="bottom-nav">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className="flex-1 relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold tracking-wide"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-x-3 top-1.5 bottom-1.5 rounded-2xl bg-primary/10 ring-1 ring-primary/15"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon
                className={cn(
                  "h-[22px] w-[22px] relative transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span className={cn("relative", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
            </Link>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
