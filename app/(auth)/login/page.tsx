import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">EduOps AI</h1>
        <p className="text-muted-foreground text-sm">Sign in to your account</p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <a href="/signup" className="text-primary font-medium">
          Sign up free
        </a>
      </p>
    </div>
  );
}
