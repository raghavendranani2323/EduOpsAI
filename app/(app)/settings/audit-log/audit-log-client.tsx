"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Activity, UserPlus, Pencil, Trash2, Calendar, KeyRound, Power, ShieldCheck,
  ChevronRight, ChevronDown, ArrowDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface Entry {
  id: string;
  actorUserId: string;
  actorName: string;
  actorHint: string | null;
  action: string;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  entries: Entry[];
  filterAction: string;
  nextCursor: string | null;
  actions: Array<{ action: string; count: number }>;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  "staff.create":          { label: "Staff added",            icon: UserPlus,  tone: "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-500/15" },
  "staff.reactivate":      { label: "Staff re-added",          icon: UserPlus,  tone: "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/15" },
  "staff.update":          { label: "Staff updated",           icon: Pencil,    tone: "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15" },
  "academicYear.create":   { label: "Academic year created",   icon: Calendar,  tone: "text-primary bg-primary/10" },
  "academicYear.update":   { label: "Academic year updated",   icon: Pencil,    tone: "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15" },
  "academicYear.activate": { label: "Academic year activated", icon: Power,     tone: "text-primary bg-primary/10" },
  "academicYear.delete":   { label: "Academic year deleted",   icon: Trash2,    tone: "text-destructive bg-destructive/10" },
  "auth.password.reset":   { label: "Password reset",          icon: KeyRound,  tone: "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15" },
};

function getActionMeta(action: string) {
  return ACTION_LABELS[action] ?? { label: action, icon: Activity, tone: "text-muted-foreground bg-muted" };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatExactTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function AuditLogClient({ entries: initialEntries, filterAction, nextCursor: initialCursor, actions }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const [entries, setEntries] = useState(initialEntries);
  const [cursor, setCursor]   = useState(initialCursor);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      const day = new Date(e.createdAt).toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
      });
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(e);
    }
    return [...groups.entries()];
  }, [entries]);

  const updateFilter = useCallback((value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set("action", value); else params.delete("action");
    params.delete("cursor");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [sp, pathname, router]);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams(sp.toString());
    params.set("cursor", cursor);
    const res = await fetch(`/api/audit-logs?${params.toString()}`);
    const data = await res.json() as { entries: Entry[]; nextCursor: string | null };
    setEntries(prev => [...prev, ...data.entries]);
    setCursor(data.nextCursor);
    setLoadingMore(false);
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Everything sensitive that happens in your institution — who did what, when.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={filterAction}
          onChange={(e) => updateFilter(e.target.value)}
          className="flex-1"
        >
          <option value="">All actions</option>
          {actions.map(a => {
            const meta = getActionMeta(a.action);
            return <option key={a.action} value={a.action}>{meta.label} ({a.count})</option>;
          })}
        </Select>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Actions like adding staff, creating academic years and resetting passwords will show up here."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, dayEntries]) => (
            <div key={day} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{day}</p>
              <Card className="overflow-hidden">
                <div className="divide-y divide-border">
                  {dayEntries.map(e => {
                    const meta = getActionMeta(e.action);
                    const Icon = meta.icon;
                    const isExpanded = expanded.has(e.id);
                    const metaTarget = (e.meta?.fullName ?? e.meta?.name ?? null) as string | null;

                    return (
                      <button
                        key={e.id}
                        onClick={() => toggle(e.id)}
                        className="w-full text-left p-3.5 hover:bg-muted/50 transition-colors active:scale-[0.999] flex items-start gap-3"
                      >
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${meta.tone}`}>
                          <Icon className="h-4 w-4" strokeWidth={2.4} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold leading-tight">{meta.label}</p>
                            {metaTarget && (
                              <Badge variant="outline" className="font-medium truncate max-w-[10rem]">
                                {metaTarget}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by <span className="font-medium text-foreground/80">{e.actorName}</span>
                            {" · "}{timeAgo(e.createdAt)}
                          </p>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 text-xs">
                              <div className="grid gap-1">
                                <Row label="When" value={formatExactTime(e.createdAt)} />
                                {e.actorHint && <Row label="Actor contact" value={e.actorHint} />}
                                {e.targetId && <Row label="Target id" value={e.targetId} mono />}
                              </div>
                              {e.meta && Object.keys(e.meta).length > 0 && (
                                <div className="rounded-lg bg-muted p-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Details</p>
                                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-foreground/80">
                                    {JSON.stringify(e.meta, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-muted-foreground">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}

          {cursor && (
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="w-full">
              <ArrowDown /> {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground shrink-0 w-24">{label}</span>
      <span className={`text-foreground/90 break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
