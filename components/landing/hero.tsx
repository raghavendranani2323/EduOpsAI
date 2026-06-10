import Link from "next/link";
import { ArrowRight, Check, X, Sparkles } from "lucide-react";

const STUDENTS = [
  { name: "Aarav Sharma", roll: 1, present: true },
  { name: "Diya Patel", roll: 2, present: true },
  { name: "Ishaan Reddy", roll: 3, present: false },
  { name: "Meera Iyer", roll: 4, present: true },
  { name: "Rohan Gupta", roll: 5, present: true },
];

function PhoneMockup() {
  return (
    <div className="relative w-full max-w-[310px] mx-auto animate-float">
      <div className="absolute -inset-8 glow-accent rounded-full opacity-70" aria-hidden />
      <div className="relative rounded-[2.5rem] border border-white/15 bg-ink-2 p-2 shadow-lg">
        <div className="rounded-[2rem] bg-background text-foreground overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Attendance · Today</p>
                <p className="font-display font-semibold text-[15px]">Class 6 – B</p>
              </div>
              <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2.5 py-1 ring-1 ring-primary/15">
                4 / 5 present
              </span>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {STUDENTS.map((s, i) => (
              <li
                key={s.roll}
                className="flex items-center gap-3 px-4 py-2.5 animate-rise"
                style={{ animationDelay: `${400 + i * 120}ms` }}
              >
                <span className="h-7 w-7 rounded-full bg-[var(--surface-2)] text-[10px] font-bold flex items-center justify-center text-muted-foreground shrink-0">
                  {s.roll}
                </span>
                <span className="text-[13px] font-medium flex-1 truncate">{s.name}</span>
                <span
                  className={
                    s.present
                      ? "h-7 w-7 rounded-full bg-[var(--success)] text-white flex items-center justify-center shrink-0"
                      : "h-7 w-7 rounded-full bg-destructive/12 text-destructive ring-1 ring-destructive/25 flex items-center justify-center shrink-0"
                  }
                >
                  {s.present ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
              </li>
            ))}
          </ul>
          <div className="p-3">
            <div className="rounded-full bg-primary text-primary-foreground text-center text-[13px] font-semibold py-2.5 shadow-sm">
              Submit · 38 seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative bg-ink text-ink-foreground overflow-hidden pt-16">
      <div className="absolute inset-0 hero-grid opacity-40" aria-hidden />
      <div className="absolute -top-40 right-[10%] h-[28rem] w-[28rem] glow-primary rounded-full" aria-hidden />
      <div className="absolute bottom-0 -left-32 h-96 w-96 glow-accent rounded-full opacity-50" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 lg:py-24 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center">
        <div className="text-center lg:text-left">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-ink-foreground/80 animate-rise"
            style={{ animationDelay: "0ms" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Built for Indian schools, coaching centres &amp; preschools
          </span>

          <h1
            className="font-display text-fluid-hero font-semibold tracking-tight mt-5 animate-rise"
            style={{ animationDelay: "100ms" }}
          >
            Run your school
            <br />
            from <span className="text-accent italic">one screen.</span>
          </h1>

          <p
            className="text-fluid-lead text-ink-foreground/65 mt-5 max-w-xl mx-auto lg:mx-0 animate-rise"
            style={{ animationDelay: "200ms" }}
          >
            Mark attendance for 40 students in under a minute. Collect fees with UPI and
            automatic reminders. Reach every parent on WhatsApp — without spreadsheets,
            registers or chaos.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mt-8 animate-rise"
            style={{ animationDelay: "300ms" }}
          >
            <Link
              href="/signup"
              className="tap w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent text-accent-foreground px-7 py-3.5 text-[15px] font-bold shadow-lg hover:-translate-y-0.5 hover:shadow-glow transition-all"
            >
              Start free — 10 min setup
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="tap w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3.5 text-[15px] font-semibold text-ink-foreground hover:bg-white/5 transition-colors"
            >
              See how it works
            </a>
          </div>

          <p className="text-xs text-ink-foreground/45 mt-5 animate-rise" style={{ animationDelay: "400ms" }}>
            Free for up to 50 students · No credit card · Works on any phone
          </p>
        </div>

        <div className="animate-rise" style={{ animationDelay: "250ms" }}>
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
