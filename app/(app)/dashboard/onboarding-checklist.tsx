import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, Rocket } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Step {
  done: boolean;
  title: string;
  description: string;
  href: string;
}

interface Props {
  hasAcademicYear: boolean;
  hasTeacher:      boolean;
  hasClass:        boolean;
  hasStudent:      boolean;
  hasAttendance:   boolean;
  hasFeePlan:      boolean;
}

export function OnboardingChecklist({
  hasAcademicYear, hasTeacher, hasClass, hasStudent, hasAttendance, hasFeePlan,
}: Props) {
  const steps: Step[] = [
    { done: hasAcademicYear, title: "Set academic year",   description: "Pick which year your classes belong to.", href: "/settings/academic-year" },
    { done: hasTeacher,      title: "Add a teacher",        description: "Phone-OTP login works immediately.",     href: "/settings/team" },
    { done: hasClass,        title: "Create a class",       description: "Then add sections under it.",             href: "/classes" },
    { done: hasStudent,      title: "Enroll students",      description: "One-by-one or bulk import from CSV.",     href: "/students/new" },
    { done: hasAttendance,   title: "Mark first attendance",description: "Practice once — under 60 seconds.",       href: "/attendance" },
    { done: hasFeePlan,      title: "Set up a fee plan",    description: "Components + late fee + sibling tiers.",  href: "/fees/plans" },
  ];

  const completed = steps.filter(s => s.done).length;
  const total = steps.length;

  // Hide the panel once the institution has finished onboarding
  if (completed === total) return null;

  const pct = Math.round((completed / total) * 100);

  // Past the halfway mark the school is up and running — collapse to a single
  // line so KPIs stay above the fold. Native <details>, no client JS.
  if (completed > total / 2) {
    const next = steps.find(s => !s.done);
    return (
      <details className="group rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10">
        <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden min-h-[44px]">
          <Rocket className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 text-sm font-semibold truncate">
            Setup {completed}/{total}{next ? ` · next: ${next.title}` : ""}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
        </summary>
        <ul className="px-3 pb-3 space-y-1">
          {steps.map((step) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-primary/5 ${step.done ? "opacity-60" : ""}`}
              >
                {step.done
                  ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                }
                <span className={`text-sm font-semibold ${step.done ? "line-through" : ""}`}>{step.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/5 dark:bg-primary/10">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold tracking-tight">Get started</p>
              <p className="text-[11px] uppercase font-bold tracking-wider text-primary">{completed} / {total}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Finish setup so you can run the school from this dashboard.
            </p>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-primary/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <ul className="mt-4 space-y-1">
          {steps.map((step) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 -mx-1 transition-colors hover:bg-primary/5 active:scale-[0.99] ${step.done ? "opacity-60" : ""}`}
              >
                {step.done
                  ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${step.done ? "line-through" : ""}`}>{step.title}</p>
                  {!step.done && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                </div>
                {!step.done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
