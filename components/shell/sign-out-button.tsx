"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
  variant?: "sidebar" | "settings";
}

export function SignOutButton({ className, variant = "sidebar" }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (variant === "settings") {
    return (
      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className={cn(
          "flex w-full items-center gap-3 border rounded-xl p-3 text-left hover:bg-muted transition-colors disabled:opacity-60",
          className
        )}
      >
        <LogOut className="h-5 w-5 text-primary" />
        <span className="flex-1">
          <span className="block font-medium text-sm">Sign out</span>
          <span className="block text-xs text-muted-foreground">End this session on this device</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-60",
        className
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
