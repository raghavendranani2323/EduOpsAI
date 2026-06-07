"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Copy, Check, UserPlus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AddTeacherSheet } from "@/components/staff/add-teacher-sheet";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["ADMIN", "TEACHER", "ACCOUNTANT"]),
});

type FormData = z.infer<typeof schema>;

interface Member { id: string; userId: string; fullName: string; role: string }
interface Invitation { id: string; email: string; role: string; expiresAt: string; token: string }

interface Props {
  institutionName: string;
  currentUserId: string;
  canInvite: boolean;
  members: Member[];
  invitations: Invitation[];
}

export function TeamPageClient({ canInvite, members, invitations }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "TEACHER" },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setLastInviteUrl(result.inviteUrl);
    reset();
    setLoading(false);
    router.refresh();
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage staff and pending invitations</p>
        </div>
        {canInvite && (
          <Button onClick={() => setAddTeacherOpen(true)} size="md">
            <UserPlus />
            Add teacher
          </Button>
        )}
      </div>

      {canInvite && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Or send an email invitation</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">For staff who prefer to sign up themselves with their own password.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
              <Input type="email" placeholder="email@example.com" {...register("email")} />
              <Select {...register("role")}>
                <option value="ADMIN">Admin</option>
                <option value="TEACHER">Teacher</option>
                <option value="ACCOUNTANT">Accountant</option>
              </Select>
            </div>
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button type="submit" disabled={loading} variant="outline" size="md">
              {loading ? "Sending…" : "Send invitation"}
            </Button>
          </form>

          {lastInviteUrl && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium">Share this link with the invitee:</p>
              <div className="flex items-center gap-2 bg-background border rounded-lg px-2 py-1.5">
                <code className="text-xs flex-1 truncate">{lastInviteUrl}</code>
                <button
                  onClick={() => copyLink(lastInviteUrl)}
                  className="text-primary p-1 hover:bg-muted rounded"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      <AddTeacherSheet open={addTeacherOpen} onOpenChange={setAddTeacherOpen} onCreated={() => router.refresh()} />

      <section className="space-y-3">
        <h2 className="font-semibold text-sm">Team ({members.length})</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border rounded-lg p-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                {m.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{m.fullName}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.role.toLowerCase()}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {invitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Pending invitations ({invitations.length})</h2>
          <div className="space-y-2">
            {invitations.map((i) => (
              <div key={i.id} className="flex items-center gap-3 border rounded-lg p-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{i.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{i.role.toLowerCase()}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  expires {new Date(i.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
