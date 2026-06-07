"use client";

import Link from "next/link";
import { useState } from "react";
import { GraduationCap, Menu, LogOut, Settings, Users, IndianRupee, BookOpen, Calendar, Bell, ClipboardList, MessageCircle, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

interface TopBarProps {
  institutionName: string;
  userEmail?: string | null;
}

const MORE_LINKS = [
  { href: "/students",       icon: Users,           label: "Students"       },
  { href: "/fees",           icon: IndianRupee,     label: "Fees"           },
  { href: "/exams",          icon: ClipboardList,   label: "Exams"          },
  { href: "/timetable",      icon: Calendar,        label: "Timetable"      },
  { href: "/homework",       icon: BookOpen,        label: "Homework"       },
  { href: "/notices",        icon: Bell,            label: "Notices"        },
  { href: "/admissions",     icon: UserPlus,        label: "Admissions"     },
  { href: "/communications", icon: MessageCircle,   label: "Communications" },
  { href: "/settings",       icon: Settings,        label: "Settings"       },
];

export function TopBar({ institutionName, userEmail }: TopBarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (userEmail ?? "U").slice(0, 1).toUpperCase();

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 glass border-b border-border/60 flex items-center gap-1 px-3 h-14">
        <button
          onClick={() => setOpen(true)}
          className="tap h-10 w-10 -ml-1 rounded-xl flex items-center justify-center active:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
          <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm truncate tracking-tight">{institutionName}</span>
        </div>
        <Link
          href="/settings"
          className="tap h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold ring-1 ring-primary/20"
          aria-label="Account"
        >
          {initial}
        </Link>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh]">
          <SheetHeader>
            <SheetTitle>{institutionName}</SheetTitle>
            {userEmail && <p className="text-xs text-muted-foreground mt-0.5 truncate">{userEmail}</p>}
          </SheetHeader>
          <SheetBody>
            <div className="grid grid-cols-3 gap-2">
              {MORE_LINKS.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3.5 transition-all hover:bg-[var(--surface-1)] hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight">{label}</span>
                </Link>
              ))}
            </div>
            <button
              onClick={signOut}
              className="mt-5 w-full flex items-center justify-center gap-2 border border-destructive/30 text-destructive rounded-xl py-3 text-sm font-semibold hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
