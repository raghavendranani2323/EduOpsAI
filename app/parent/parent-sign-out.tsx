"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function ParentSignOut({ compact = false, block = false }: { compact?: boolean; block?: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/parent/login");
    router.refresh();
  }

  if (compact) {
    return (
      <button onClick={signOut} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-50">
        <LogOut className="h-3.5 w-3.5" />
        <span>Sign out</span>
      </button>
    );
  }
  if (block) {
    return (
      <button
        onClick={signOut}
        disabled={busy}
        className="tap w-full flex items-center justify-center gap-2 border border-destructive/30 text-destructive rounded-xl py-3 text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    );
  }
  return (
    <button onClick={signOut} disabled={busy} className="text-xs text-primary underline">Sign out</button>
  );
}
