import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Starter",
    price: "₹0",
    unit: "forever",
    desc: "For tuition centres and small preschools getting started.",
    features: ["Up to 50 students", "Attendance & classes", "Fee tracking", "Parent portal links", "1 admin + 2 teachers"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Growth",
    price: "₹15",
    unit: "per student / month",
    desc: "For growing schools and coaching centres that want automation.",
    features: [
      "Unlimited students & staff",
      "UPI fee collection (Razorpay)",
      "WhatsApp reminders & notices",
      "Exams, report cards & homework",
      "Admissions CRM",
      "Priority support",
    ],
    cta: "Start 30-day trial",
    highlight: true,
  },
  {
    name: "Institution",
    price: "Custom",
    unit: "annual billing",
    desc: "For multi-branch schools and large institutions.",
    features: ["Everything in Growth", "Multiple branches", "Custom roles & audit logs", "Data export & onboarding help", "Dedicated account manager"],
    cta: "Talk to us",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-16">
      <Reveal>
        <h2 className="font-display text-fluid-title font-semibold text-center">
          Honest pricing, in rupees.
        </h2>
        <p className="text-center text-muted-foreground mt-3">
          No per-feature surprises. Pay for students you actually have.
        </p>
      </Reveal>
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 mt-12 items-stretch">
        {PLANS.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.1}>
            <div
              className={cn(
                "relative rounded-2xl p-6 sm:p-7 h-full flex flex-col",
                p.highlight
                  ? "bg-ink text-ink-foreground shadow-lg ring-1 ring-primary/30 lg:scale-[1.03]"
                  : "border border-border bg-card"
              )}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent text-accent-foreground text-[11px] font-bold px-3 py-1 shadow-md whitespace-nowrap">
                  Most popular
                </span>
              )}
              <h3 className="font-semibold text-sm uppercase tracking-wider opacity-70">{p.name}</h3>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold tabular-nums">{p.price}</span>
                <span className={cn("text-xs", p.highlight ? "text-ink-foreground/55" : "text-muted-foreground")}>{p.unit}</span>
              </p>
              <p className={cn("text-sm mt-2.5 leading-relaxed", p.highlight ? "text-ink-foreground/70" : "text-muted-foreground")}>
                {p.desc}
              </p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span className={cn(
                      "mt-0.5 h-4.5 w-4.5 rounded-full flex items-center justify-center shrink-0",
                      p.highlight ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"
                    )}>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={cn(
                  "tap mt-7 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition-all hover:-translate-y-px",
                  p.highlight
                    ? "bg-accent text-accent-foreground shadow-md hover:shadow-lg"
                    : "border border-border bg-card hover:bg-[var(--surface-1)] shadow-xs"
                )}
              >
                {p.cta}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Do parents need to install an app?",
    a: "No. Parents get a secure link on WhatsApp that opens their child's attendance, fees, homework and notices in any browser. Zero installs, zero passwords.",
  },
  {
    q: "Does it work on low-end Android phones?",
    a: "Yes. EduOps is built mobile-first and tested on 5-inch budget Android devices. It also works offline for attendance and syncs when you're back online.",
  },
  {
    q: "Can it handle our fee structure?",
    a: "Monthly, quarterly and annual plans, transport and exam fees, late fines, sibling discounts and partial payments are all supported out of the box.",
  },
  {
    q: "How do we move from our current registers or Excel?",
    a: "Export your student list to CSV and import it in one step. Most schools are fully running within a day.",
  },
  {
    q: "Is our data safe and private?",
    a: "Every institution's data is fully isolated at the database level. Your data is yours — export it anytime, and we never share it.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-[var(--surface-1)] border-y border-border scroll-mt-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal>
          <h2 className="font-display text-fluid-title font-semibold text-center">Questions, answered.</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05}>
              <details className="group rounded-2xl border border-border bg-card open:shadow-md transition-shadow">
                <summary className="tap flex items-center justify-between gap-4 cursor-pointer select-none list-none px-5 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
      <Reveal>
        <div className="relative rounded-[2rem] bg-ink text-ink-foreground overflow-hidden px-6 py-14 sm:px-12 sm:py-20 text-center">
          <div className="absolute inset-0 hero-grid opacity-40" aria-hidden />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 glow-accent rounded-full" aria-hidden />
          <h2 className="relative font-display text-fluid-title font-semibold max-w-xl mx-auto">
            Bring your school online this week.
          </h2>
          <p className="relative text-ink-foreground/65 mt-4 max-w-md mx-auto text-sm sm:text-base">
            Set up in 10 minutes. Free for your first 50 students. Your teachers will thank you tomorrow morning.
          </p>
          <Link
            href="/signup"
            className="tap relative inline-flex items-center justify-center gap-2 rounded-full bg-accent text-accent-foreground px-8 py-4 text-[15px] font-bold shadow-lg hover:-translate-y-0.5 hover:shadow-glow transition-all mt-8"
          >
            Create your institution
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
