"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft, Calendar, Sparkles, Check, Eye, BadgePercent,
} from "lucide-react";
import { formatINR } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlanRow {
  id: string;
  name: string;
  amount: number;
  cadence: string;
  classId: string | null;
  className: string | null;
}

interface ClassRow { id: string; label: string; count: number }

interface PreviewRow {
  studentId: string;
  fullName: string;
  amountDue: number;
  ordinal: number;
  discountPercent: number;
  skipped: boolean;
}

interface Props {
  plans: PlanRow[];
  classes: ClassRow[];
  hasSiblingDiscount: boolean;
}

const CADENCE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annual", ONE_TIME: "One-time",
};

function firstOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, m - 1, 1).toISOString().split("T")[0];
}
function lastOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, m, 0).toISOString().split("T")[0];
}
function thisMonthIST(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function GenerateClient({ plans, classes, hasSiblingDiscount }: Props) {
  const router = useRouter();
  const [planId, setPlanId]         = useState<string>("");
  const [month, setMonth]           = useState<string>(thisMonthIST());
  const [classIds, setClassIds]     = useState<Set<string>>(new Set());
  const [dueDate, setDueDate]       = useState<string>(() => {
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    ist.setUTCDate(10);
    return ist.toISOString().split("T")[0];
  });
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; created: number; skipped: number; discounted: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = plans.find(p => p.id === planId);
  const eligibleClasses = useMemo(() => {
    if (!selectedPlan) return classes;
    if (selectedPlan.classId) return classes.filter(c => c.id === selectedPlan.classId);
    return classes;
  }, [selectedPlan, classes]);

  function toggleClass(id: string) {
    setClassIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setPreview(null);
  }

  function toggleAll() {
    if (classIds.size === eligibleClasses.length) {
      setClassIds(new Set());
    } else {
      setClassIds(new Set(eligibleClasses.map(c => c.id)));
    }
    setPreview(null);
  }

  async function loadPreview() {
    if (!planId || !month || !dueDate) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/fees/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          classIds: classIds.size === 0 ? null : [...classIds],
          periodStart: firstOfMonth(month),
          periodEnd:   lastOfMonth(month),
          dueDate,
          dryRun: true,
        }),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      setPreview({
        rows: result.preview,
        created: result.preview.filter((r: PreviewRow) => !r.skipped).length,
        skipped: result.preview.filter((r: PreviewRow) => r.skipped).length,
        discounted: result.discounted,
        total: result.total,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm() {
    if (!planId || !month || !dueDate) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/fees/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          classIds: classIds.size === 0 ? null : [...classIds],
          periodStart: firstOfMonth(month),
          periodEnd:   lastOfMonth(month),
          dueDate,
        }),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${result.created} invoice${result.created === 1 ? "" : "s"} created`, {
        description: result.skipped > 0 ? `${result.skipped} skipped (already exist)` : undefined,
      });
      router.push("/fees");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const totalAmount = preview ? preview.rows.filter(r => !r.skipped).reduce((s, r) => s + r.amountDue, 0) : 0;

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-5 pb-44">
      <div className="flex items-center gap-3">
        <Link href="/fees" className="tap h-10 w-10 -ml-1 rounded-xl flex items-center justify-center hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Generate invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bulk-create invoices for a plan + period.</p>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold">No fee plans yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Create a plan first.</p>
          <Button onClick={() => router.push("/fees/plans")}>Go to plans</Button>
        </Card>
      ) : (
        <>
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              <p className="font-semibold text-sm">Select a fee plan</p>
            </div>
            <Select value={planId} onChange={(e) => { setPlanId(e.target.value); setClassIds(new Set()); setPreview(null); }}>
              <option value="">— Choose a plan —</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatINR(p.amount)} {CADENCE_LABELS[p.cadence]}
                </option>
              ))}
            </Select>
            {selectedPlan && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <Badge variant="default">{CADENCE_LABELS[selectedPlan.cadence]}</Badge>
                <Badge variant="secondary">{selectedPlan.className ?? "All classes"}</Badge>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono font-semibold">{formatINR(selectedPlan.amount)} per student</span>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              <p className="font-semibold text-sm">Period & due date</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Period</Label>
                <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPreview(null); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setPreview(null); }} />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
                <p className="font-semibold text-sm">Classes</p>
              </div>
              <button type="button" onClick={toggleAll} className="text-xs text-primary font-semibold hover:underline">
                {classIds.size === eligibleClasses.length ? "Clear" : "Select all"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Leave empty to apply to <strong>all eligible classes</strong>.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {eligibleClasses.map(c => {
                const on = classIds.has(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleClass(c.id)}
                    className={`text-left rounded-xl border p-2.5 text-xs transition-colors active:scale-[0.98] ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {on && <Check className="h-3 w-3 shrink-0" />}
                      <span className="font-semibold">{c.label}</span>
                    </div>
                    <p className={`mt-1 ${on ? "opacity-90" : "text-muted-foreground"}`}>{c.count} student{c.count === 1 ? "" : "s"}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          {hasSiblingDiscount && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-2.5">
              <BadgePercent className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                <strong>Sibling discount enabled.</strong> Siblings are detected by shared primary guardian phone, ordered by enrolment date.
                The tier from <Link href="/settings/institution" className="underline">Settings → Institution</Link> applies automatically.
              </p>
            </div>
          )}

          {preview && preview.rows.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/50">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preview</p>
              </div>
              <ul className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                {preview.rows.map(r => (
                  <li key={r.studentId} className={`flex items-center gap-3 px-4 py-2.5 ${r.skipped ? "opacity-50" : ""}`}>
                    {r.skipped ? (
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider shrink-0">Exists</span>
                    ) : (
                      <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    )}
                    <span className="text-sm flex-1 truncate">{r.fullName}</span>
                    {r.discountPercent > 0 && (
                      <Badge variant="success" className="font-mono">{`-${r.discountPercent}%`}</Badge>
                    )}
                    <span className="text-sm font-bold tabular-nums shrink-0">{formatINR(r.amountDue)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="fixed bottom-0 inset-x-0 md:left-60 bg-card/95 backdrop-blur-md border-t border-border p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] z-20">
            <div className="max-w-3xl mx-auto space-y-2">
              {preview && (
                <Card className="p-3 space-y-1.5">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Will create" value={preview.created} variant="primary" />
                    <Stat label="Skipped (exist)" value={preview.skipped} variant="muted" />
                    <Stat label="With discount" value={preview.discounted} variant="success" />
                  </div>
                  {totalAmount > 0 && (
                    <p className="text-center text-xs text-muted-foreground">
                      Total billing: <span className="font-bold text-foreground tabular-nums">{formatINR(totalAmount)}</span>
                    </p>
                  )}
                </Card>
              )}

              {!preview ? (
                <Button
                  onClick={loadPreview}
                  size="lg" className="w-full"
                  disabled={!planId || !month || !dueDate || submitting}
                >
                  <Eye /> {submitting ? "Previewing…" : "Preview"}
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="lg" onClick={() => setPreview(null)} disabled={submitting}>
                    Edit
                  </Button>
                  <Button size="lg" onClick={confirm} disabled={submitting || preview.created === 0}>
                    <Sparkles /> Create {preview.created}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant: "primary" | "muted" | "success" }) {
  const color = variant === "primary" ? "text-primary" : variant === "success" ? "text-green-700 dark:text-green-300" : "text-muted-foreground";
  return (
    <div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
