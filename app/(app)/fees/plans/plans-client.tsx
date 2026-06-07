"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil, Trash2, X } from "lucide-react";
import { formatINR } from "@/lib/format/currency";

const schema = z.object({
  name:             z.string().min(1, "Name is required"),
  amount:           z.number().min(0.01, "Amount must be > 0"),
  cadence:          z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
  lateFeeAmount:    z.number().min(0),
  lateFeeAfterDays: z.number().min(0),
  classId:          z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Plan {
  id: string;
  name: string;
  amount: number;
  cadence: string;
  lateFeeAmount: number;
  lateFeeAfterDays: number;
  classId: string | null;
  class: { id: string; name: string } | null;
}

interface Props {
  plans:   Plan[];
  classes: { id: string; name: string }[];
}

const CADENCE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annual", ONE_TIME: "One-time",
};

export function PlansClient({ plans: initial, classes }: Props) {
  const router = useRouter();
  const [plans, setPlans]   = useState(initial);
  const [open, setOpen]     = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { cadence: "MONTHLY", lateFeeAmount: 0, lateFeeAfterDays: 10 },
  });

  function openCreate() {
    setEditing(null);
    reset({ cadence: "MONTHLY", lateFeeAmount: 0, lateFeeAfterDays: 10 });
    setOpen(true);
    setError(null);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    reset({
      name: p.name,
      amount: p.amount / 100,          // paise → rupees for display
      cadence: p.cadence as FormData["cadence"],
      lateFeeAmount: p.lateFeeAmount / 100,
      lateFeeAfterDays: p.lateFeeAfterDays,
      classId: p.classId ?? "",
    });
    setOpen(true);
    setError(null);
  }

  function close() { setOpen(false); setEditing(null); setError(null); }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    const payload = {
      ...data,
      amount:        Math.round(data.amount * 100),          // rupees → paise
      lateFeeAmount: Math.round((data.lateFeeAmount ?? 0) * 100),
      classId:       data.classId || null,
    };
    const url    = editing ? `/api/fees/plans/${editing.id}` : "/api/fees/plans";
    const method = editing ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }

    if (editing) {
      setPlans(prev => prev.map(p => p.id === editing.id
        ? { ...p, ...payload, class: classes.find(c => c.id === payload.classId) ?? null }
        : p
      ));
    } else {
      setPlans(prev => [...prev, { ...result.plan, class: classes.find(c => c.id === payload.classId) ?? null }]);
    }
    close();
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    const res = await fetch(`/api/fees/plans/${deleting.id}`, { method: "DELETE" });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    setPlans(prev => prev.filter(p => p.id !== deleting.id));
    setDeleting(null);
    setSaving(false);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/fees" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Fee Plans</h1>
          <p className="text-sm text-muted-foreground">{plans.length} plans</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Add plan
        </button>
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">No fee plans yet</p>
          <p className="text-sm">Add your first plan to start generating invoices.</p>
        </div>
      )}

      <div className="space-y-2">
        {plans.map(p => (
          <div key={p.id} className="flex items-center gap-3 border rounded-xl p-3.5">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatINR(p.amount)} · {CADENCE_LABELS[p.cadence] ?? p.cadence}
                {p.class ? ` · ${p.class.name}` : " · All classes"}
                {p.lateFeeAmount > 0 ? ` · Late: ${formatINR(p.lateFeeAmount)} after ${p.lateFeeAfterDays}d` : ""}
              </p>
            </div>
            <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => setDeleting(p)} className="p-2 rounded-lg hover:bg-destructive/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? "Edit fee plan" : "New fee plan"}</h2>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Plan name *</label>
                <input {...register("name")} placeholder="Monthly Tuition Fee" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Amount (₹) *</label>
                  <input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} placeholder="3500" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  {errors.amount && <p className="text-destructive text-xs mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cadence *</label>
                  <select {...register("cadence")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="ONE_TIME">One-time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Late fee (₹)</label>
                  <input type="number" step="0.01" {...register("lateFeeAmount", { valueAsNumber: true })} placeholder="100" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">After days</label>
                  <input type="number" {...register("lateFeeAfterDays", { valueAsNumber: true })} placeholder="10" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Apply to class (optional)</label>
                <select {...register("classId")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={close} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleting(null)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-4 shadow-xl">
            <h2 className="font-semibold">Delete &quot;{deleting.name}&quot;?</h2>
            <p className="text-sm text-muted-foreground">This won&apos;t delete existing invoices.</p>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
              <button onClick={confirmDelete} disabled={saving} className="flex-1 bg-destructive text-destructive-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
