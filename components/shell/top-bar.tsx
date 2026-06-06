"use client";

import { GraduationCap, Bell } from "lucide-react";

interface TopBarProps {
  institutionName: string;
}

export function TopBar({ institutionName }: TopBarProps) {
  return (
    <header className="md:hidden sticky top-0 z-40 bg-background border-b flex items-center justify-between px-4 h-14">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm truncate max-w-[180px]">{institutionName}</span>
      </div>
      <button
        className="relative p-2 rounded-full hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </button>
    </header>
  );
}
