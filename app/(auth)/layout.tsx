import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-ink text-ink-foreground relative overflow-hidden">
        <div className="absolute inset-0 hero-grid opacity-40" />
        <div className="absolute -top-32 -right-32 h-96 w-96 glow-primary rounded-full" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 glow-accent rounded-full opacity-60" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shadow-md">
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
            <span className="font-display font-semibold tracking-tight">EduOps AI</span>
          </div>
        </div>
        <div className="relative space-y-4 animate-rise">
          <p className="font-display text-fluid-title font-semibold leading-tight tracking-tight">
            Run your school from a single screen.
          </p>
          <p className="text-sm text-ink-foreground/65 max-w-sm leading-relaxed">
            Attendance, fees, exams, parents — all in one mobile-first workspace
            built for Indian institutions.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            <span className="text-xs text-ink-foreground/50">Trusted by schools, coaching centres &amp; preschools across India</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12 sm:py-16">
        <div className="w-full max-w-sm animate-rise">{children}</div>
      </div>
    </div>
  );
}
