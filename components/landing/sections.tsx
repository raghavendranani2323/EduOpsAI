import {
  CalendarCheck, IndianRupee, MessageCircle, UserPlus, ClipboardList,
  Smartphone, FileSpreadsheet, Rocket, Building2,
} from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const TRUSTED = [
  "Coaching centres", "Tuition centres", "Preschools", "Independent schools",
];

export function TrustMarquee() {
  return (
    <section className="border-b border-border bg-[var(--surface-1)] py-5 overflow-hidden">
      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">
        Designed for owner-led education teams in India
      </p>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--surface-1)] to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--surface-1)] to-transparent z-10" />
        <div className="flex w-max animate-marquee gap-10 pr-10">
          {[...TRUSTED, ...TRUSTED].map((name, i) => (
            <span key={i} className="flex items-center gap-2 text-sm font-medium text-muted-foreground whitespace-nowrap">
              <Building2 className="h-4 w-4 opacity-60" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { value: "40+", label: "students marked from one mobile screen" },
  { value: "3", label: "collection modes tracked: cash, UPI and bank" },
  { value: "1", label: "timeline for every admission follow-up" },
  { value: "0", label: "parent app installs required" },
];

export function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08}>
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 text-center h-full">
              <p className="font-display text-3xl sm:text-4xl font-semibold text-primary tabular-nums">{s.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">{s.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Attendance in under a minute",
    desc: "Tap-to-mark in roll-number order. Attendance can be queued during a brief network interruption and conflict-checked on reconnect.",
    span: true,
  },
  {
    icon: IndianRupee,
    title: "Fee tracking without spreadsheet drift",
    desc: "Monthly, quarterly or annual plans, partial payments, sibling discounts, due lists and manual cash or UPI collection records.",
    span: true,
  },
  {
    icon: MessageCircle,
    title: "WhatsApp-first communication",
    desc: "Prepare notices, homework and fee reminders for WhatsApp. Delivery tracking is available when a provider is configured.",
  },
  {
    icon: UserPlus,
    title: "Admissions pipeline",
    desc: "Capture enquiries, follow up on time, and convert more leads into admissions.",
  },
  {
    icon: ClipboardList,
    title: "Exams & report cards",
    desc: "Enter marks on mobile, share beautiful report cards with parents in one tap.",
  },
  {
    icon: Smartphone,
    title: "A portal parents love",
    desc: "Attendance, fees, homework and notices — one link, no app install needed.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-[var(--surface-1)] border-y border-border scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal>
          <p className="text-center text-xs uppercase tracking-[0.2em] text-accent-foreground font-bold">
            <span className="bg-accent/15 rounded-full px-3 py-1 ring-1 ring-accent/25">Everything in one place</span>
          </p>
          <h2 className="font-display text-fluid-title font-semibold text-center mt-5 max-w-2xl mx-auto">
            Replace the register, the diary and five WhatsApp groups.
          </h2>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.07} className={cn(f.span && "lg:col-span-2")}>
              <div className="group rounded-2xl border border-border bg-card p-6 h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-[15px] mt-4">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: Rocket,
    step: "01",
    title: "Create your institution",
    desc: "Sign up, name your school, set your academic year. Under 10 minutes, no sales call.",
  },
  {
    icon: FileSpreadsheet,
    step: "02",
    title: "Import your students",
    desc: "Upload a simple CSV or add classes and students by hand. Invite teachers with one link.",
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "Run day one",
    desc: "Mark attendance, generate fee invoices, send your first WhatsApp notice — same day.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-16">
      <Reveal>
        <h2 className="font-display text-fluid-title font-semibold text-center">
          Online by <span className="italic text-primary">this evening.</span>
        </h2>
        <p className="text-center text-muted-foreground mt-3 max-w-lg mx-auto">
          No demos, no onboarding team, no migration project. Three steps and your school runs on EduOps.
        </p>
      </Reveal>
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mt-12">
        {STEPS.map((s, i) => (
          <Reveal key={s.step} delay={i * 0.12}>
            <div className="relative rounded-2xl border border-border bg-card p-6 h-full overflow-hidden">
              <span className="absolute -top-3 -right-1 font-display text-[5rem] leading-none font-semibold text-primary/8 select-none" aria-hidden>
                {s.step}
              </span>
              <div className="h-11 w-11 rounded-xl bg-accent/15 text-accent-foreground ring-1 ring-accent/25 flex items-center justify-center">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-[15px] mt-4">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    quote: "Mark attendance, see absentees, and prepare parent follow-up without moving between registers and chat groups.",
    name: "Teacher workflow",
    role: "Built for one-handed use on budget Android phones",
  },
  {
    quote: "Track what was due, what was collected, and which families still need a reminder.",
    name: "Owner workflow",
    role: "Clear operational records instead of unverified promises",
  },
  {
    quote: "Open one secure link for attendance, homework, notices and fee visibility without installing another app.",
    name: "Parent workflow",
    role: "Revocable links and OTP access controls",
  },
];

export function Testimonials() {
  return (
    <section className="bg-ink text-ink-foreground relative overflow-hidden">
      <div className="absolute inset-0 hero-grid opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal>
          <h2 className="font-display text-fluid-title font-semibold text-center">
            Built around the work people actually do.
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mt-12">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.12}>
              <figure className="rounded-2xl border border-white/10 bg-white/5 p-6 h-full backdrop-blur-sm">
                <p className="font-display text-2xl text-accent leading-none select-none" aria-hidden>&ldquo;</p>
                <blockquote className="text-sm leading-relaxed text-ink-foreground/85 mt-1">{t.quote}</blockquote>
                <figcaption className="mt-5 pt-4 border-t border-white/10">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-ink-foreground/55 mt-0.5">{t.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
