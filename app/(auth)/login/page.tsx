import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="md:hidden flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">E</div>
          <span className="font-bold text-base tracking-tight">EduOps AI</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your school workspace.</p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <a href="/signup" className="text-primary font-semibold hover:underline underline-offset-2">
          Create an account
        </a>
      </p>
      <div className="border-t border-border pt-5 text-center">
        <a href="/parent/login" className="text-xs text-muted-foreground hover:text-primary font-medium tracking-wide uppercase">
          Are you a parent? Sign in here →
        </a>
      </div>
    </div>
  );
}
