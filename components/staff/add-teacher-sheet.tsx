"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Check, Copy, Plus, X, BookOpen, Phone, Mail, IdCard, Award, UserPlus,
  ShieldCheck, MessageCircle, Smartphone, AtSign, Info,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const schema = z.object({
  fullName:      z.string().min(2, "Full name required"),
  phone:         z.string().min(10, "10-digit number required"),
  email:         z.string().email("Invalid email").optional().or(z.literal("")),
  designation:   z.string().optional(),
  qualification: z.string().optional(),
  role:          z.enum(["TEACHER", "ADMIN", "ACCOUNTANT"]),
});
type FormData = z.infer<typeof schema>;

const DESIGNATIONS = ["Class Teacher", "PRT", "TGT", "PGT", "Principal", "Vice Principal", "Coordinator", "Lab Assistant", "Sports Coach", "Other"];

interface SubjectOption { id: string; name: string }

interface Credentials {
  mode: "email" | "phone";
  identifier: string;
  password: string;
  loginUrl: string;
  whatsappShare: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (staff: { id: string; fullName: string; role: string }) => void;
  defaultRole?: "TEACHER" | "ADMIN" | "ACCOUNTANT";
}

export function AddTeacherSheet({ open, onOpenChange, onCreated, defaultRole = "TEACHER" }: Props) {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [newSubjects, setNewSubjects] = useState<string[]>([]);
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole },
  });

  const role = watch("role");
  const phoneVal = watch("phone");
  const emailRequired = role === "ADMIN" || role === "ACCOUNTANT";

  useEffect(() => {
    if (!open) return;
    fetch("/api/subjects")
      .then(r => r.json())
      .then((d: { ok: boolean; subjects?: SubjectOption[] }) => {
        if (d.ok && d.subjects) setSubjects(d.subjects);
      })
      .catch(() => {});
  }, [open]);

  function resetAll() {
    reset({ role: defaultRole });
    setSelectedSubjectIds(new Set());
    setNewSubjects([]);
    setNewSubjectInput("");
    setCredentials(null);
  }

  function toggleSubject(id: string) {
    setSelectedSubjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addNewSubject() {
    const v = newSubjectInput.trim();
    if (!v) return;
    if (newSubjects.includes(v) || subjects.some(s => s.name.toLowerCase() === v.toLowerCase())) {
      setNewSubjectInput("");
      return;
    }
    setNewSubjects(prev => [...prev, v]);
    setNewSubjectInput("");
  }

  async function onSubmit(data: FormData) {
    if (emailRequired && !data.email) {
      setValue("email", "");
      toast.error("Email is required for admins and accountants");
      return;
    }
    setSubmitting(true);
    const payload = {
      ...data,
      subjectIds: [...selectedSubjectIds],
      newSubjects,
    };
    try {
      const res = await fetch("/api/staff/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(result.error ?? "Failed to add teacher");
        return;
      }
      onCreated?.(result.staff);
      if (result.credentials) {
        toast.success(`${data.fullName} added`);
        setCredentials(result.credentials);
      } else if (result.reactivatedExisting) {
        toast.success(`${data.fullName} re-added to this institution`, {
          description: "Existing user — their password was not reset. Ask them to sign in with their existing password.",
          duration: 6000,
        });
        close();
      } else {
        toast.success(`${data.fullName} added`);
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
    const phone = credentials?.mode === "phone" ? credentials.identifier.replace(/\D/g, "") : "";
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent side="bottom" className="max-h-[94dvh]">
        <SheetHeader>
          <SheetTitle>{credentials ? "Login created" : "Add a new teacher"}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {credentials ? "Share these details — the teacher can sign in right away." : "We'll create a login they can use immediately."}
          </p>
        </SheetHeader>

        {credentials ? (
          <>
            <SheetBody className="space-y-4">
              <div className="rounded-2xl border border-green-200 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-green-600 text-white flex items-center justify-center">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-900 dark:text-green-100">Account ready</p>
                    <p className="text-[11px] text-green-700 dark:text-green-300">
                      Sign-in method: {credentials.mode === "phone" ? "Phone + password" : "Email + password"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <CopyRow
                    label={credentials.mode === "phone" ? "Mobile number" : "Email"}
                    icon={credentials.mode === "phone" ? Smartphone : AtSign}
                    value={credentials.identifier}
                    keyName="identifier"
                    copied={copiedField}
                    onCopy={copyToClipboard}
                  />
                  <CopyRow
                    label="Password"
                    icon={ShieldCheck}
                    value={credentials.password}
                    keyName="password"
                    copied={copiedField}
                    onCopy={copyToClipboard}
                    mono
                  />
                  <CopyRow
                    label="Login page"
                    value={credentials.loginUrl}
                    keyName="url"
                    copied={copiedField}
                    onCopy={copyToClipboard}
                  />
                </div>
              </div>

              <Button
                variant="success"
                size="lg"
                className="w-full"
                onClick={() => shareWhatsApp(credentials.whatsappShare)}
              >
                <MessageCircle /> Share via WhatsApp
              </Button>

              <button
                onClick={() => {
                  setCredentials(null);
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
              {/* Role first — determines how teacher logs in */}
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

              {/* Login mode notice */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/10 px-3 py-2.5 flex gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  {role === "TEACHER"
                    ? <>Teachers sign in with <strong>mobile number + password</strong> at <code className="font-mono text-[11px]">/teacher-login</code>. Email is optional.</>
                    : <>Admins &amp; accountants sign in with <strong>email + password</strong> at <code className="font-mono text-[11px]">/login</code>. Email is required.</>}
                </p>
              </div>

              {/* Basic */}
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
                label={emailRequired ? "Email *" : "Email (optional)"}
                icon={Mail}
                error={errors.email?.message}
                hint={emailRequired ? "Will be used for sign-in" : "Useful for password reset, otherwise skip"}
              >
                <Input type="email" placeholder="anjali@school.edu" {...register("email")} />
              </Field>

              {/* Designation + qualification */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Designation" icon={IdCard}>
                  <Select {...register("designation")}>
                    <option value="">—</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="Qualification" icon={Award}>
                  <Input placeholder="B.Ed, M.A" {...register("qualification")} />
                </Field>
              </div>

              {/* Subjects — only meaningful for TEACHER */}
              {role === "TEACHER" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> Subjects they teach</Label>
                  {subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {subjects.map(s => {
                        const on = selectedSubjectIds.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSubject(s.id)}
                            className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                              on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"
                            }`}
                          >
                            {on && <Check className="inline h-3 w-3 mr-1" />}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {newSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {newSubjects.map(n => (
                        <span key={n} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 bg-primary/10 text-primary border border-primary/20">
                          {n}
                          <button type="button" onClick={() => setNewSubjects(prev => prev.filter(x => x !== n))} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder={subjects.length ? "Add a custom subject" : "Type a subject (e.g. Mathematics)"}
                      value={newSubjectInput}
                      onChange={e => setNewSubjectInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNewSubject(); } }}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={addNewSubject} size="md"><Plus /></Button>
                  </div>
                </div>
              )}
            </SheetBody>

            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create"}
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

function CopyRow({ label, icon: Icon, value, keyName, copied, onCopy, mono }: {
  label: string;
  icon?: React.ElementType;
  value: string;
  keyName: string;
  copied: string | null;
  onCopy: (v: string, k: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-green-800 dark:text-green-300 mb-1 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <span className={`flex-1 text-sm truncate ${mono ? "font-mono tracking-wider" : ""}`}>{value}</span>
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
