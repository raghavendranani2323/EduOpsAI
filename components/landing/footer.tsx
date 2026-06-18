import Link from "next/link";
import { GraduationCap } from "lucide-react";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "For schools",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Teacher login", href: "/teacher-login" },
      { label: "Parent portal", href: "/parent/login" },
    ],
  },
  {
    title: "Trust & help",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Data rights", href: "/data-rights" },
      { label: "Support", href: "/support" },
      { label: "Service status", href: "/status" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-ink text-ink-foreground border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
              <GraduationCap className="h-4.5 w-4.5" />
            </span>
            <span className="font-display font-semibold tracking-tight text-[17px]">EduOps AI</span>
          </div>
          <p className="text-sm text-ink-foreground/55 mt-4 max-w-xs leading-relaxed">
            The mobile-first operations platform for Indian schools, coaching centres,
            preschools and tuition centres.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-xs uppercase tracking-[0.18em] font-bold text-ink-foreground/40">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-ink-foreground/70 hover:text-ink-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-ink-foreground/45">© {new Date().getFullYear()} EduOps AI. Made in India 🇮🇳</p>
          <p className="text-xs text-ink-foreground/45">Attendance · Fees · WhatsApp · Admissions</p>
        </div>
      </div>
    </footer>
  );
}
