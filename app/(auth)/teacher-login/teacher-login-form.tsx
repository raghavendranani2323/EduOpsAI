"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, AlertCircle, Phone, Lock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const schema = z.object({
  phone:    z.string().min(10, "Enter a 10-digit phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && raw.startsWith("+")) return raw;
  if (raw.startsWith("+") && digits.length >= 10) return raw;
  return null;
}

export function TeacherLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const phoneInput = watch("phone");
  const normalized = phoneInput ? normalizeIndianPhone(phoneInput) : null;

  async function onSubmit(data: FormData) {
    setError(null);
    const phone = normalizeIndianPhone(data.phone);
    if (!phone) { setError("Enter a valid 10-digit Indian phone number"); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ phone, password: data.password });
    setLoading(false);
    if (err) {
      const msg = /invalid login/i.test(err.message)
        ? "Phone or password is incorrect. Ask your school admin to reset it."
        : err.message;
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Signed in");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="9876543210"
            className="pl-9"
            {...register("phone")}
          />
        </div>
        {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
        {!errors.phone && normalized && (
          <p className="text-xs text-muted-foreground">Will sign in as {normalized}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-9 pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Don&apos;t know your password? Ask your school admin — they can reset it from the Team page.
      </p>
    </form>
  );
}
