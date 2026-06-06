import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">EduOps AI</h1>
        <p className="text-muted-foreground text-sm">Create your institution account</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="text-primary font-medium">Sign in</a>
      </p>
    </div>
  );
}
