"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, ChevronRight, MessageCircle, X, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { Input, Select } from "@/components/ui/input";

const STATUSES = [
  { value: "ALL",      label: "All" },
  { value: "UNPAID",   label: "Unpaid" },
  { value: "PARTIAL",  label: "Partial" },
  { value: "PAID",     label: "Paid" },
  { value: "OVERDUE",  label: "Overdue" },
];

const STATUS_STYLES: Record<string, string> = {
  PAID:      "bg-green-100 text-green-700",
  PARTIAL:   "bg-amber-100 text-amber-700",
  UNPAID:    "bg-red-100 text-red-700",
  CANCELLED: "bg-muted text-muted-foreground",
};

interface Invoice {
  id: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string;
  periodStart: string | null;
  student: { id: string; fullName: string; admissionNo: string | null; className: string | null };
  lastPayment: { amount: number; mode: string; paidAt: string } | null;
}

interface Props {
  invoices: Invoice[];
  classes: { id: string; name: string }[];
  total: number;
  nextCursor: string | null;
  currentFilters: { status: string; classId: string; month: string; q: string };
}

interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  nextCursor: string | null;
}

export function FeesClient({ invoices: init, classes, total: initTotal, currentFilters }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const searchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryParams = new URLSearchParams();
  if (currentFilters.status) queryParams.set("status", currentFilters.status);
  if (currentFilters.classId) queryParams.set("classId", currentFilters.classId);
  if (currentFilters.month) queryParams.set("month", currentFilters.month);
  if (currentFilters.q) queryParams.set("q", currentFilters.q);
  const qs = queryParams.toString();

  const { data, isFetching } = useCachedQuery<InvoicesResponse>(
    ["fees", currentFilters.status, currentFilters.classId, currentFilters.month, currentFilters.q],
    async () => {
      const res = await fetch(`/api/fees/invoices?${qs}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    {
      cacheKey: `fees:${qs}`,
      initialData: { invoices: init, total: initTotal, nextCursor: null },
      ssrSeeded: true,
    },
  );

  const invoices = data?.invoices ?? init;
  const total = data?.total ?? initTotal;
  const [reminders, setReminders] = useState<Array<{ invoiceId: string; studentName: string; guardianName: string | null; guardianPhone: string; amount: number; link: string }>>([]);
  const [sending,    setSending]   = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [sentMap,    setSentMap]   = useState<Record<string, boolean>>({});

  const sendReminders = useCallback(async (scope: "overdue" | "month") => {
    setSending(true);
    setReminderError(null);
    setSentMap({});
    const res = await fetch("/api/fees/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        classId: currentFilters.classId || undefined,
        month:   scope === "month" ? currentFilters.month : undefined,
      }),
    });
    const result = await res.json();
    setSending(false);
    if (!result.ok) { setReminderError(result.error ?? "Failed"); return; }
    setReminders(result.reminders ?? []);
  }, [currentFilters.classId, currentFilters.month]);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("cursor");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [sp, pathname, router]
  );

  return (
    <div className="space-y-3">
      {/* Reminders action row */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => sendReminders("overdue")}
          disabled={sending}
          className="flex items-center gap-1.5 bg-amber-600 text-white rounded-xl px-3 py-2 text-xs font-medium min-h-[36px] disabled:opacity-60"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {sending ? "Preparing…" : "Remind overdue"}
        </button>
        <button
          onClick={() => sendReminders("month")}
          disabled={sending}
          className="flex items-center gap-1.5 border rounded-xl px-3 py-2 text-xs font-medium min-h-[36px] disabled:opacity-60 hover:bg-muted"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Remind all this month
        </button>
        {reminderError && <span className="text-xs text-destructive self-center">{reminderError}</span>}
      </div>

      {/* Reminders dialog */}
      {reminders.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-card border rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-semibold text-sm">Send {reminders.length} reminder{reminders.length === 1 ? "" : "s"}</p>
                <p className="text-xs text-muted-foreground">Tap each to open WhatsApp</p>
              </div>
              <button
                onClick={() => setReminders([])}
                className="p-2 rounded-lg hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {reminders.map(r => (
                <div key={r.invoiceId} className="flex items-center gap-3 border rounded-lg p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.guardianName ?? "Parent"} · {r.guardianPhone} · {formatINR(r.amount)}
                    </p>
                  </div>
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSentMap(m => ({ ...m, [r.invoiceId]: true }))}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium min-h-[36px] shrink-0 ${
                      sentMap[r.invoiceId]
                        ? "bg-muted text-muted-foreground"
                        : "bg-green-600 text-white"
                    }`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {sentMap[r.invoiceId] ? "Sent" : "Send"}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => updateFilter("status", s.value === "ALL" ? "" : s.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
              currentFilters.status === s.value || (s.value === "ALL" && !currentFilters.status)
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search student…"
            defaultValue={currentFilters.q}
            onChange={e => {
              if (searchRef.current) clearTimeout(searchRef.current);
              searchRef.current = setTimeout(() => updateFilter("q", e.target.value), 350);
            }}
            className="pl-9"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        <Input
          type="month"
          value={currentFilters.month}
          onChange={e => updateFilter("month", e.target.value)}
          className="w-auto"
        />

        <Select
          value={currentFilters.classId}
          onChange={e => updateFilter("classId", e.target.value)}
          className="w-auto"
        >
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{total} invoice{total !== 1 ? "s" : ""}</p>

      {/* List */}
      {invoices.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium">No invoices found</p>
          <p className="text-sm mt-1">Try adjusting filters or <Link href="/fees/generate" className="text-primary underline">generate invoices</Link>.</p>
        </div>
      )}

      <div className="space-y-2">
        {invoices.map(inv => {
          const isOverdue = (inv.status === "UNPAID" || inv.status === "PARTIAL") && inv.dueDate < new Date().toISOString().split("T")[0];
          const statusStyle = isOverdue ? "bg-red-100 text-red-700" : (STATUS_STYLES[inv.status] ?? "");

          return (
            <Link
              key={inv.id}
              href={`/fees/invoices/${inv.id}`}
              className="flex items-center gap-3 border rounded-xl p-3.5 bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{inv.student.fullName}</p>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${statusStyle}`}>
                    {isOverdue ? "Overdue" : inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inv.student.className ?? "No class"}
                  {inv.periodStart ? ` · ${formatDate(inv.periodStart)}` : ""}
                  {" · "}Due {formatDate(inv.dueDate)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm">{formatINR(inv.amountDue)}</p>
                {inv.amountPaid > 0 && (
                  <p className="text-xs text-green-700">{formatINR(inv.amountPaid)} paid</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
