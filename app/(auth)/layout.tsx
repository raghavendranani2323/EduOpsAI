export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary)_60%,black)] text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 hero-grid opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center font-bold text-sm">E</div>
            <span className="font-bold tracking-tight">EduOps AI</span>
          </div>
        </div>
        <div className="relative space-y-3">
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            Run your school from a single screen.
          </p>
          <p className="text-sm opacity-80">
            Attendance, fees, exams, parents — all in one mobile-first workspace built for Indian institutions.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12 sm:py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
