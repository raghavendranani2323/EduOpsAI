"use client";

import { GraduationCap } from "lucide-react";

interface TopBarProps {
  institutionName: string;
}

export function TopBar({ institutionName }: TopBarProps) {
  return (
    <header className="md:hidden sticky top-0 z-40 bg-background border-b flex items-center gap-2 px-4 h-14">
      <GraduationCap className="h-5 w-5 text-primary shrink-0" />
      <span className="font-semibold text-sm truncate">{institutionName}</span>
    </header>
  );
}
