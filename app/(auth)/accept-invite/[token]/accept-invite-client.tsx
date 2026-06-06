"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  token: string;
  email: string;
  expired: boolean;
  accepted: boolean;
  userEmail: string | null;
}

export function AcceptInviteClient({ token, email, expired, accepted, userEmail }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (accepted) {
    return (
      <div className="bg-muted rounded-lg p-4 text-sm text-center text-muted-foreground">
        This invitation has already been accepted.
      </div>
    );
  }

  if (expired) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-center text-destructive">
        This invitation has expired. Please ask the admin for a new one.
      </div>
    );
  }

  if (!userEmail) {
    const target = `/signup?email=${encodeURIComponent(email)}&invite=${token}`;
    const loginTarget = `/login?email=${encodeURIComponent(email)}&invite=${token}`;
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Sign up or log in with <span className="font-medium text-foreground">{email}</span> to accept this invitation.
        </p>
        <div className="flex gap-2">
          <a href={target} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm">Sign up</a>
          <a href={loginTarget} className="flex-1 border rounded-lg py-2.5 font-medium text-sm">Log in</a>
        </div>
      </div>
    );
  }

  if (userEmail.toLowerCase() !== email.toLowerCase()) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
        This invitation is for <strong>{email}</strong>, but you&apos;re logged in as <strong>{userEmail}</strong>. Please log out and use the correct account.
      </div>
    );
  }

  async function handleAccept() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result = await res.json();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
      >
        {loading ? "Accepting…" : "Accept invitation"}
      </button>
    </div>
  );
}
