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

const NAV_ITEMS = [
  { href: "/dashboard",      icon: LayoutDashboard, label: "Dashboard"      },
  { href: "/students",       icon: Users,           label: "Students"       },
  { href: "/attendance",     icon: CalendarCheck,   label: "Attendance"     },
  { href: "/fees",           icon: IndianRupee,     label: "Fees"           },
  { href: "/exams",          icon: ClipboardList,   label: "Exams"          },
  { href: "/timetable",      icon: Calendar,        label: "Timetable"      },
  { href: "/homework",       icon: BookOpen,        label: "Homework"       },
  { href: "/notices",        icon: Bell,            label: "Notices"        },
  { href: "/admissions",     icon: UserPlus,        label: "Admissions"     },
  { href: "/communications", icon: MessageCircle,   label: "Communications" },
  { href: "/settings",       icon: Settings,        label: "Settings"       },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-background shrink-0 h-screen sticky top-0">
      <div className="flex items-center gap-2 px-4 py-4 border-b">
        <GraduationCap className="h-6 w-6 text-primary" />
        <span className="font-bold text-sm">EduOps AI</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
