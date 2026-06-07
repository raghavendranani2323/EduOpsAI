"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ParentChild } from "@/lib/parent/children";

export function ChildSwitcher({ children, selectedId }: { children: ParentChild[]; selectedId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function pick(id: string) {
    if (id === selectedId) return;
    await fetch("/api/parent/child", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: id }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
      {children.map(c => {
        const active = c.id === selectedId;
        const initials = c.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
        return (
          <button
            key={c.id}
            onClick={() => pick(c.id)}
            disabled={pending}
            className={`shrink-0 flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-all active:scale-[0.98] ${
              active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card hover:bg-muted"
            }`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${active ? "bg-white/20" : "bg-primary/10 text-primary"}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate max-w-[8rem]">{c.fullName.split(" ")[0]}</p>
              <p className={`text-[10px] truncate max-w-[8rem] ${active ? "opacity-90" : "text-muted-foreground"}`}>
                {c.className ?? "—"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
