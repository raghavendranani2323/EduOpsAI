import { GraduationCap } from "lucide-react";
import { ParentLoginForm } from "./parent-login-form";
import { isParentOtpEnabled } from "@/lib/parent/config";

export const dynamic = "force-dynamic";

export default function ParentLoginPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/30">
      <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground px-6 pt-10 pb-8">
        <div className="flex items-center gap-2 text-xs opacity-90 mb-2">
          <GraduationCap className="h-4 w-4" />
          <span>EduOps AI</span>
        </div>
        <h1 className="text-2xl font-bold">Parent login</h1>
        <p className="text-sm opacity-90 mt-1">View your child&apos;s attendance, fees, homework and notices.</p>
      </div>

      <main className="flex-1 p-6 max-w-md mx-auto w-full -mt-4">
        <div className="bg-card border rounded-2xl shadow-sm p-5">
          <ParentLoginForm enabled={isParentOtpEnabled()} />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-6">
          Trouble signing in? Ask your school for your private portal link.
        </p>
      </main>
    </div>
  );
}
