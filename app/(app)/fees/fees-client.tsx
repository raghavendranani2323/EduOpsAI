"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { formatINR } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

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

export function FeesClient({ invoices: init, classes, total, currentFilters }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const [invoices] = useState(init);
  const searchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          <input
            type="search"
            placeholder="Search student…"
            defaultValue={currentFilters.q}
            onChange={e => {
              if (searchRef.current) clearTimeout(searchRef.current);
              searchRef.current = setTimeout(() => updateFilter("q", e.target.value), 400);
            }}
            className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          />
        </div>

        <input
          type="month"
          value={currentFilters.month}
          onChange={e => updateFilter("month", e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
        />

        <select
          value={currentFilters.classId}
          onChange={e => updateFilter("classId", e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
        >
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
