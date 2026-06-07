"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Pencil, Trash2, IndianRupee, Calendar, BookOpen,
  AlertCircle, Layers, FileText, Sparkles, Wallet,
} from "lucide-react";
import { formatINR } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";

const COMPONENT_PRESETS = [
  { name: "Tuition Fee",   amount: 0 },
  { name: "Transport",     amount: 0 },
  { name: "Lab Fee",       amount: 0 },
  { name: "Library Fee",   amount: 0 },
  { name: "Exam Fee",      amount: 0 },
  { name: "Sports Fee",    amount: 0 },
];

const componentSchema = z.object({
  name:       z.string().min(1, "Required"),
  amount:     z.number().min(0, "≥ 0"),
  isOptional: z.boolean().optional(),
});

const schema = z.object({
  name:             z.string().min(1, "Plan name required"),
  cadence:          z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
  components:       z.array(componentSchema).min(1, "Add at least one component"),
  lateFeeMode:      z.enum(["NONE", "FLAT", "PERCENT"]),
  lateFeeAmount:    z.number().min(0).optional(),
  lateFeePercent:   z.number().min(0).max(100).optional(),
  lateFeeAfterDays: z.number().int().min(0),
  classId:          z.string().optional(),
  academicYearId:   z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Component {
  id?: string;
  name: string;
  amount: number;
  isOptional?: boolean;
}

interface Plan {
  id: string;
  name: string;
  amount: number;
  cadence: string;
  lateFeeAmount: number;
  lateFeePercent: number;
  lateFeeAfterDays: number;
  classId: string | null;
  academicYearId: string | null;
  class: { id: string; name: string; section: string | null } | null;
  academicYear: { id: string; name: string } | null;
  components: Component[];
}

interface ClassRow { id: string; name: string; section: string | null }
interface YearRow  { id: string; name: string; isActive: boolean }

interface Props {
  plans: Plan[];
  classes: ClassRow[];
  academicYears: YearRow[];
}

const CADENCE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annual", ONE_TIME: "One-time",
};

function classLabel(c: ClassRow | null) {
  if (!c) return "All classes";
  return c.section ? `${c.name} – ${c.section}` : c.name;
}

export function PlansClient({ plans: initial, classes, academicYears }: Props) {
  const router = useRouter();
  const [plans, setPlans]   = useState(initial);
  const [open, setOpen]     = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const activeYearId = academicYears.find(y => y.isActive)?.id ?? academicYears[0]?.id;

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      cadence: "MONTHLY",
      lateFeeMode: "NONE",
      lateFeeAfterDays: 10,
      components: [{ name: "Tuition Fee", amount: 0 }],
      academicYearId: activeYearId,
    },
  });

  const components = useFieldArray({ control, name: "components" });
  const lateFeeMode = watch("lateFeeMode");
  const watchedComponents = watch("components") ?? [];
  const total = watchedComponents.reduce((s, c) => s + (Number(c?.amount) || 0), 0);

  function openCreate() {
    setEditing(null);
    reset({
      name: "",
      cadence: "MONTHLY",
      lateFeeMode: "NONE",
      lateFeeAmount: 0,
      lateFeePercent: 0,
      lateFeeAfterDays: 10,
      components: [{ name: "Tuition Fee", amount: 0 }],
      classId: "",
      academicYearId: activeYearId,
    });
    setOpen(true);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    const mode: FormData["lateFeeMode"] =
      p.lateFeePercent > 0 ? "PERCENT" : p.lateFeeAmount > 0 ? "FLAT" : "NONE";
    reset({
      name: p.name,
      cadence: p.cadence as FormData["cadence"],
      lateFeeMode: mode,
      lateFeeAmount: p.lateFeeAmount / 100,
      lateFeePercent: p.lateFeePercent / 100,
      lateFeeAfterDays: p.lateFeeAfterDays,
      components: p.components.length
        ? p.components.map(c => ({ name: c.name, amount: c.amount / 100, isOptional: c.isOptional }))
        : [{ name: p.name, amount: p.amount / 100 }],
      classId: p.classId ?? "",
      academicYearId: p.academicYearId ?? activeYearId ?? "",
    });
    setOpen(true);
  }

  function close() { setOpen(false); setEditing(null); }

  function addPreset(preset: typeof COMPONENT_PRESETS[number]) {
    if (watchedComponents.some(c => c?.name?.toLowerCase() === preset.name.toLowerCase())) return;
    components.append(preset);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = {
        name:             data.name,
        cadence:          data.cadence,
        components: data.components.map(c => ({
          name:       c.name.trim(),
          amount:     Math.round(c.amount * 100),
          isOptional: c.isOptional ?? false,
        })),
        lateFeeAmount:    data.lateFeeMode === "FLAT"    ? Math.round((data.lateFeeAmount  ?? 0) * 100)  : 0,
        lateFeePercent:   data.lateFeeMode === "PERCENT" ? Math.round((data.lateFeePercent ?? 0) * 100)  : 0,
        lateFeeAfterDays: data.lateFeeAfterDays,
        classId:          data.classId || null,
        academicYearId:   data.academicYearId || null,
      };
      const url    = editing ? `/api/fees/plans/${editing.id}` : "/api/fees/plans";
      const method = editing ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(editing ? "Plan updated" : "Plan created");
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fees/plans/${deleting.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      setPlans(prev => prev.filter(p => p.id !== deleting.id));
      toast.success("Plan deleted");
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div className="flex items-start gap-3">
        <Link href="/fees" className="tap h-10 w-10 -ml-1 rounded-xl flex items-center justify-center hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Fee plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build plans from components (tuition + transport + lab…). Generate invoices in bulk.
          </p>
        </div>
        <Button onClick={openCreate} size="md">
          <Plus /> <span className="hidden sm:inline">New plan</span>
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No fee plans yet"
          description="Create a plan to start generating monthly or quarterly invoices."
          action={<Button onClick={openCreate}><Plus /> Create your first plan</Button>}
        />
      ) : (
        <div className="space-y-3">
          {plans.map(p => (
            <Card key={p.id}>
              <div className="p-4 flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-base tracking-tight">{p.name}</p>
                    <Badge variant="default">{CADENCE_LABELS[p.cadence] ?? p.cadence}</Badge>
                    {p.academicYear && <Badge variant="outline">{p.academicYear.name}</Badge>}
                    <Badge variant="secondary">{classLabel(p.class)}</Badge>
                  </div>
                  <p className="text-2xl font-bold tabular-nums mt-1.5">{formatINR(p.amount)}</p>
                  {p.components.length > 0 && (
                    <ul className="mt-2 grid sm:grid-cols-2 gap-x-3 gap-y-0.5">
                      {p.components.map(c => (
                        <li key={c.id} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                          <span>{c.name}{c.isOptional ? " (opt.)" : ""}</span>
                          <span className="font-mono tabular-nums">{formatINR(c.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(p.lateFeeAmount > 0 || p.lateFeePercent > 0) && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Late fee: {p.lateFeePercent > 0
                        ? `${(p.lateFeePercent / 100).toFixed(1)}%`
                        : formatINR(p.lateFeeAmount)}
                      {" after "}{p.lateFeeAfterDays} days
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="iconSm" variant="ghost" onClick={() => openEdit(p)} aria-label="Edit">
                    <Pencil />
                  </Button>
                  <Button size="iconSm" variant="ghost" onClick={() => setDeleting(p)} aria-label="Delete" className="text-destructive hover:bg-destructive/10">
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT SHEET */}
      <Sheet open={open} onOpenChange={(v) => !v && close()}>
        <SheetContent side="bottom" className="max-h-[94dvh]">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit fee plan" : "New fee plan"}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {editing ? "Update the components and rules." : "Add components like Tuition, Transport, Lab Fee…"}
            </p>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <SheetBody className="space-y-5">
              <Field label="Plan name *" error={errors.name?.message} icon={FileText}>
                <Input autoFocus placeholder="Class 6 — 2026-27 monthly" {...register("name")} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Cadence *" icon={Calendar}>
                  <Select {...register("cadence")}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="ONE_TIME">One-time</option>
                  </Select>
                </Field>
                <Field label="Academic year">
                  <Select {...register("academicYearId")}>
                    <option value="">Default (active)</option>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name}{y.isActive ? " · current" : ""}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Applies to class" icon={BookOpen}>
                <Select {...register("classId")}>
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                </Select>
              </Field>

              {/* Components builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Layers className="h-3 w-3" /> Components *</Label>
                  <span className="text-xs font-bold tabular-nums">{formatINR(Math.round(total * 100))}</span>
                </div>

                <div className="space-y-2">
                  {components.fields.map((field, i) => (
                    <div key={field.id} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
                      <Input
                        {...register(`components.${i}.name` as const)}
                        placeholder="Tuition Fee"
                        className="flex-1 h-10 text-sm"
                      />
                      <div className="flex items-center gap-1 rounded-lg bg-muted px-2 h-10">
                        <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="number" step="1" min="0"
                          {...register(`components.${i}.amount` as const, { valueAsNumber: true })}
                          placeholder="3500"
                          className="w-24 h-8 text-sm border-0 bg-transparent shadow-none focus-visible:shadow-none p-0"
                        />
                      </div>
                      <Button
                        type="button" variant="ghost" size="iconSm"
                        onClick={() => components.fields.length > 1 && components.remove(i)}
                        disabled={components.fields.length === 1}
                        className="text-destructive hover:bg-destructive/10 disabled:opacity-30"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
                {errors.components && <p className="text-destructive text-xs">{errors.components.message}</p>}

                {/* Quick-add presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {COMPONENT_PRESETS.map(p => {
                    const already = watchedComponents.some(c => c?.name?.toLowerCase() === p.name.toLowerCase());
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => addPreset(p)}
                        disabled={already}
                        className="text-xs rounded-full px-3 py-1.5 border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Late fee */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> Late fee</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["NONE", "FLAT", "PERCENT"] as const).map(m => (
                    <label key={m} className="cursor-pointer">
                      <input type="radio" value={m} {...register("lateFeeMode")} className="peer sr-only" />
                      <div className="rounded-xl border border-border p-2.5 text-center text-xs font-semibold peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary transition">
                        {m === "NONE" ? "None" : m === "FLAT" ? "Flat ₹" : "Percent %"}
                      </div>
                    </label>
                  ))}
                </div>
                {lateFeeMode !== "NONE" && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {lateFeeMode === "FLAT" ? (
                      <Field label="Amount (₹)">
                        <Input type="number" min="0" step="1" {...register("lateFeeAmount", { valueAsNumber: true })} />
                      </Field>
                    ) : (
                      <Field label="Percent of dues">
                        <Input type="number" min="0" max="100" step="0.5" {...register("lateFeePercent", { valueAsNumber: true })} />
                      </Field>
                    )}
                    <Field label="After (days)">
                      <Input type="number" min="0" {...register("lateFeeAfterDays", { valueAsNumber: true })} />
                    </Field>
                  </div>
                )}
              </div>
            </SheetBody>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                <Sparkles /> {saving ? "Saving…" : editing ? "Save changes" : "Create plan"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* DELETE */}
      <Sheet open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Delete &quot;{deleting?.name}&quot;?</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <p className="text-sm">Existing invoices for this plan remain untouched. You can only delete a plan with no invoices yet.</p>
          </SheetBody>
          <SheetFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, error, icon: Icon, children }: { label: string; error?: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
