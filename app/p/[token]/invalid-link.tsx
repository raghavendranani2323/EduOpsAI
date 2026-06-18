import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export function InvalidParentLink({ expired = false }: { expired?: boolean }) {
  return (
    <main className="min-h-[100dvh] bg-muted/30 p-4 flex items-center justify-center">
      <Card className="max-w-md w-full p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-amber-600 mx-auto" />
        <h1 className="text-xl font-bold">{expired ? "This parent link has expired" : "This parent link is not valid"}</h1>
        <p className="text-sm text-muted-foreground">
          For your child&apos;s privacy, links expire and can be revoked. Ask the institution office to generate a new link, or use OTP sign-in if enabled.
        </p>
        <Link href="/parent/login" className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">
          Try parent OTP login
        </Link>
        <p className="text-xs text-muted-foreground">Never forward parent links outside your family.</p>
      </Card>
    </main>
  );
}
