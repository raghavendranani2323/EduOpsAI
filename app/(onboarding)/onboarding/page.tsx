import { OnboardingForm } from "./onboarding-form";
import { requireUser } from "@/lib/auth/session";

export default async function OnboardingPage() {
  await requireUser();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Set up your institution</h1>
          <p className="text-muted-foreground text-sm">This takes less than 2 minutes</p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
