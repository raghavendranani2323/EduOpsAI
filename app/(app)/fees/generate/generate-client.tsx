"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Zap } from "lucide-react";
import { formatINR } from "@/lib/format/currency";
import { todayIST } from "@/lib/format/date";

interface Plan  { id: string; name: string; amount: number; cadence: string; classId: string | null }
interface Class { id: string; name: string; _count: { students: number } }

interface Props { plans: Plan[]; classes: Class[] }

export function GenerateClient({ plans, classes }: Props) {
  const router = useRouter();

  const today = todayIST(); // YYYY-MM-DD
  const [year, mon] = today.split("-").map(Number);

  const [planId,   setPlanId]   = useState(plans[0]?.id ?? "");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [month,    setMonth]    = useState(`${year}-${String(mon).padStart(2, "0")}`);
  const [dueDay,   setDueDay]   = useState("10");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<{ created: number; skipped: number } | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const selectedPlan = plans.find(p => p.id === planId);

  const targetClasses = classIds.length > 0
    ? classes.filter(c => classIds.includes(c.id))
    : classes;

  const expectedCount = targetClasses.reduce((s, c) => s + c._count.students, 0);

  function toggleClass(id: string) {
    setClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function generate() {
    if (!planId || !month) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const [y, m] = month.split("-").map(Number);
    const periodStart = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const periodEnd = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    const dueDate = `${y}-${String(m).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;

    const res = await fetch("/api/fees/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        classIds: classIds.length > 0 ? classIds : null, // null = all
        periodStart,
        periodEnd,
        dueDate,
      }),
    });
    const data = await res.json();
    if (!data.ok) { setError(data.error); setLoading(false); return; }
    setResult({ created: data.created, skipped: data.skipped });
    setLoading(false);
  }

  return (
    <div className="p-4 md:p-6 max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/fees" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Generate Invoices</h1>
      </div>

      {plans.length === 0 && (
        <div className="border rounded-xl p-4 text-sm text-muted-foreground">
          No fee plans found. <Link href="/fees/plans" className="text-primary underline">Create a plan first.</Link>
        </div>
      )}

      <div className="space-y-4">
        {/* Plan */}
        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm">Fee plan</h2>
          <div className="space-y-2">
            {plans.map(p => (
              <button
                key={p.id}
                onClick={() => setPlanId(p.id)}
                className={`w-full flex items-center gap-3 border rounded-lg p-3 text-left transition-colors ${planId === p.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
              >
                <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${planId === p.id ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatINR(p.amount)} · {p.cadence.charAt(0) + p.cadence.slice(1).toLowerCase()}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Period & due date */}
        <section className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-sm">Period</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Month *</label>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Due on day</label>
              <input
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </section>

        {/* Classes */}
        <section className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Classes</h2>
            <button
              onClick={() => setClassIds([])}
              className="text-xs text-primary underline"
            >
              {classIds.length === 0 ? "All selected" : `${classIds.length} selected`}
            </button>
          </div>
          <div className="space-y-1.5">
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => toggleClass(c.id)}
                className={`w-full flex items-center gap-3 border rounded-lg p-2.5 text-left transition-colors ${classIds.includes(c.id) ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
              >
                <div className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center ${classIds.includes(c.id) || classIds.length === 0 ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {(classIds.includes(c.id) || classIds.length === 0) && <span className="text-white text-[10px]">✓</span>}
                </div>
                <span className="text-sm">{c.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{c._count.students} students</span>
              </button>
            ))}
          </div>
        </section>

        {/* Preview */}
        {selectedPlan && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm space-y-1">
            <p className="font-medium">Preview</p>
            <p className="text-muted-foreground">
              {expectedCount} invoice{expectedCount !== 1 ? "s" : ""} × {formatINR(selectedPlan.amount)} = <strong>{formatINR(expectedCount * selectedPlan.amount)}</strong>
            </p>
            <p className="text-xs text-muted-foreground">Existing invoices for the same period will be skipped.</p>
          </div>
        )}

        {error  && <p className="text-destructive text-sm">{error}</p>}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
            ✓ Created {result.created} invoice{result.created !== 1 ? "s" : ""}
            {result.skipped > 0 ? `, ${result.skipped} skipped (already existed)` : ""}.
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading || !planId || !month || plans.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-60 min-h-[52px]"
        >
          <Zap className="h-4 w-4" />
          {loading ? "Generating…" : `Generate ${expectedCount} invoice${expectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
