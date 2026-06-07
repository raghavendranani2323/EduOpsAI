import { TeacherLoginForm } from "./teacher-login-form";

export default function TeacherLoginPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="md:hidden flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">E</div>
          <span className="font-bold text-base tracking-tight">EduOps AI</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Teacher sign in</h1>
        <p className="text-muted-foreground text-sm">Use the phone number your school registered for you.</p>
      </div>
      <TeacherLoginForm />
      <div className="text-center space-y-2">
        <a href="/login" className="block text-xs text-muted-foreground hover:text-primary font-medium uppercase tracking-wide">
          Are you an admin? Sign in with email →
        </a>
        <a href="/parent/login" className="block text-xs text-muted-foreground hover:text-primary">
          Parent login
        </a>
      </div>
    </div>
  );
}
