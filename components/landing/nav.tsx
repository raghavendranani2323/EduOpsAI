"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass border-b border-border/50">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="h-9 w-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shadow-sm">
            <GraduationCap className="h-4.5 w-4.5" />
          </span>
          <span className="font-display font-semibold tracking-tight text-[17px]">EduOps AI</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 mx-auto">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3.5 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href="/login"
            className="px-4 py-2 rounded-full text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground shadow-sm hover:shadow-glow hover:-translate-y-px transition-all"
          >
            Start free
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden tap ml-auto h-10 w-10 rounded-xl flex items-center justify-center active:bg-muted transition-colors"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <div
        className={cn(
          "md:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-out border-border/50",
          open ? "max-h-96 opacity-100 border-t" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 py-4 flex flex-col gap-1 bg-background/95">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="tap px-4 py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-3 mt-1 border-t border-border/50">
            <Link
              href="/login"
              className="tap flex-1 flex items-center justify-center rounded-full border border-border text-sm font-semibold py-3"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="tap flex-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold py-3 shadow-sm"
            >
              Start free
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
