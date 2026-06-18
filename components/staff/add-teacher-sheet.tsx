"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Award, AtSign, Check, Copy, IdCard, Info, Mail, MessageCircle,
  Phone, ShieldCheck, UserPlus,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const schema = z.object({
  fullName: z.string().min(2, "Full name required"),
  phone: z.string().min(10, "10-digit number required"),
  email: z.string().email("Valid email required"),
  designation: z.string().optional(),
  qualification: z.string().optional(),
  role: z.enum(["TEACHER", "ADMIN", "ACCOUNTANT"]),
});
type FormData = z.infer<typeof schema>;

const DESIGNATIONS = ["Class Teacher", "PRT", "TGT", "PGT", "Principal", "Vice Principal", "Coordinator", "Lab Assistant", "Sports Coach", "Other"];

interface InviteDetails {
  email: string;
  inviteUrl: string;
  whatsappShare: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (staff: { id: string; fullName: string; role: string }) => void;
  defaultRole?: "TEACHER" | "ADMIN" | "ACCOUNTANT";
}

export function AddTeacherSheet({ open, onOpenChange, onCreated, defaultRole = "TEACHER" }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole },
  });

  const role = watch("role");
  const phoneVal = watch("phone");

  function resetAll() {
    reset({ role: defaultRole });
    setInvite(null);
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/staff/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(result.error ?? "Failed to invite staff");
        return;
      }
      onCreated?.(result.staff);
      if (result.invited && result.inviteUrl) {
        toast.success(`Invitation created for ${data.fullName}`);
        setInvite({
          email: data.email,
          inviteUrl: result.inviteUrl,
          whatsappShare: result.whatsappShare,
        });
      } else {
        toast.success(`${data.fullName} invited`);
        close();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToClipboard(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  }

  function close() {
    onOpenChange(false);
    setTimeout(resetAll, 250);
  }

  function shareWhatsApp(text: string) {
    const phone = phoneVal?.replace(/\D/g, "") ?? "";
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent side="bottom" className="max-h-[94dvh]">
        <SheetHeader>
          <SheetTitle>{invite ? "Invite created" : "Add a new teacher"}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {invite ? "Share this secure invitation link. The staff member sets up their own login." : "We'll create a secure invitation link. No passwords are shared."}
          </p>
        </SheetHeader>

        {invite ? (
          <>
            <SheetBody className="space-y-4">
              <div className="rounded-2xl border border-green-200 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-green-600 text-white flex items-center justify-center">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-900 dark:text-green-100">Invitation ready</p>
                    <p className="text-[11px] text-green-700 dark:text-green-300">Expires in 7 days and can be used once.</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <CopyRow label="Email" icon={AtSign} value={invite.email} keyName="email" copied={copiedField} onCopy={copyToClipboard} />
                  <CopyRow label="Invite link" icon={ShieldCheck} value={invite.inviteUrl} keyName="url" copied={copiedField} onCopy={copyToClipboard} />
                </div>
              </div>

              <Button variant="success" size="lg" className="w-full" onClick={() => shareWhatsApp(invite.whatsappShare)}>
                <MessageCircle /> Share invite via WhatsApp
              </Button>

              <button
                onClick={() => {
                  setInvite(null);
                  resetAll();
                }}
                className="text-xs text-primary hover:underline font-medium block mx-auto"
              >
                + Add another teacher
              </button>
            </SheetBody>
            <SheetFooter>
              <Button onClick={close} className="w-full" variant="outline" size="lg">Done</Button>
            </SheetFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <SheetBody className="space-y-5">
              <Field label="Role *">
                <div className="grid grid-cols-3 gap-2">
                  {(["TEACHER", "ADMIN", "ACCOUNTANT"] as const).map(r => {
                    const on = role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setValue("role", r, { shouldValidate: true })}
                        className={`rounded-xl border p-2.5 text-xs font-semibold transition-colors active:scale-[0.98] ${
                          on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"
                        }`}
                      >
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/10 px-3 py-2.5 flex gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  Staff accept a <strong>secure email invitation</strong> and set up their own login. Passwords are never shared in WhatsApp.
                </p>
              </div>

              <Field label="Full name *" icon={UserPlus} error={errors.fullName?.message}>
                <Input placeholder="Anjali Sharma" autoFocus {...register("fullName")} />
              </Field>

              <Field
                label="Mobile number *"
                icon={Phone}
                error={errors.phone?.message}
                hint={phoneVal && phoneVal.length >= 10 ? "+91 prefix added automatically" : "10-digit Indian number"}
              >
                <Input type="tel" inputMode="tel" placeholder="9876543210" {...register("phone")} />
              </Field>

              <Field
                label="Email *"
                icon={Mail}
                error={errors.email?.message}
                hint="Required for secure invitation and password recovery"
              >
                <Input type="email" placeholder="anjali@school.edu" {...register("email")} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Designation" icon={IdCard}>
                  <Select {...register("designation")}>
                    <option value="">-</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="Qualification" icon={Award}>
                  <Input placeholder="B.Ed, M.A" {...register("qualification")} />
                </Field>
              </div>

              {role === "TEACHER" && (
                <p className="text-xs text-muted-foreground">
                  Assign classes and subjects after the teacher accepts the invitation.
                </p>
              )}
            </SheetBody>

            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create invite"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, icon: Icon, error, hint, children }: {
  label: string;
  icon?: React.ElementType;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CopyRow({ label, icon: Icon, value, keyName, copied, onCopy }: {
  label: string;
  icon?: React.ElementType;
  value: string;
  keyName: string;
  copied: string | null;
  onCopy: (v: string, k: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-green-800 dark:text-green-300 mb-1 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <span className="flex-1 text-sm truncate">{value}</span>
        <button
          onClick={() => onCopy(value, keyName)}
          type="button"
          className="tap h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted shrink-0"
          aria-label="Copy"
        >
          {copied === keyName ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}
