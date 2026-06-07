"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, AlertCircle, Users, CheckCircle2, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface YearOption { id: string; name: string; isActive: boolean }

interface PreviewMapping {
  fromClassId: string;
  toClassId:   string;
  studentCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  years: YearOption[];
  defaultFromId?: string;
}

export function PromoteSheet({ open, onOpenChange, years, defaultFromId }: Props) {
  const router = useRouter();
  const active = years.find(y => y.isActive);
  const [fromId, setFromId] = useState<string>(defaultFromId ?? active?.id ?? years[0]?.id ?? "");
  const [toId, setToId]     = useState<string>(years.find(y => y.id !== (defaultFromId ?? active?.id))?.id ?? "");
  const [preview, setPreview] = useState<{ mapping: PreviewMapping[]; missingTargets: string[]; totalStudents: number } | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    onOpenChange(false);
    setTimeout(() => { setPreview(null); }, 250);
  }

  async function loadPreview() {
    if (!fromId || !toId || fromId === toId) {
      toast.error("Pick two different academic years");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/academic-years/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromYearId: fromId, toYearId: toId, dryRun: true }),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      setPreview({
        mapping: result.mapping ?? [],
        missingTargets: result.missingTargets ?? [],
        totalStudents: result.totalStudents ?? 0,
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    if (preview.totalStudents === 0) {
      toast.error("No students to promote");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/academic-years/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromYearId: fromId, toYearId: toId, dryRun: false }),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${result.moved} student${result.moved === 1 ? "" : "s"} promoted`, {
        description: result.missingTargets?.length
          ? `${result.missingTargets.length} class group${result.missingTargets.length === 1 ? "" : "s"} skipped (no target — create them in the new year first)`
          : undefined,
      });
      close();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fromYear = years.find(y => y.id === fromId);
  const toYear   = years.find(y => y.id === toId);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent side="bottom" className="max-h-[94dvh]">
        <SheetHeader>
          <SheetTitle>Promote to next year</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Moves every active student from their class in the source year to the matching class in the target year.
            Class groups are paired by name; sections by letter (with fallback).
          </p>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Year picker */}
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={fromId} onChange={(e) => { setFromId(e.target.value); setPreview(null); }}>
                  {years.map(y => (
                    <option key={y.id} value={y.id}>{y.name}{y.isActive ? " · Current" : ""}</option>
                  ))}
                </Select>
              </div>
              <div className="pb-2.5 text-muted-foreground">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={toId} onChange={(e) => { setToId(e.target.value); setPreview(null); }}>
                  <option value="">— Pick year —</option>
                  {years.filter(y => y.id !== fromId).map(y => (
                    <option key={y.id} value={y.id}>{y.name}{y.isActive ? " · Current" : ""}</option>
                  ))}
                </Select>
              </div>
            </div>
            {fromYear && toYear && (
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline">{fromYear.name}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="default">{toYear.name}</Badge>
              </div>
            )}
          </Card>

          {!preview ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-3">
                We&apos;ll show you exactly what will happen before anything is moved.
              </p>
              <Button onClick={loadPreview} disabled={busy || !fromId || !toId || fromId === toId} variant="outline" size="md">
                {busy ? "Checking…" : "Preview"}
              </Button>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Will move</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums mt-1 text-primary">{preview.totalStudents}</p>
                  <p className="text-xs text-muted-foreground">students</p>
                </Card>
                <Card className="p-3.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Sections paired</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums mt-1">{preview.mapping.length}</p>
                  <p className="text-xs text-muted-foreground">in target year</p>
                </Card>
              </div>

              {/* Missing targets warning */}
              {preview.missingTargets.length > 0 && (
                <Card className="p-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {preview.missingTargets.length} class{preview.missingTargets.length === 1 ? "" : "es"} won&apos;t be promoted
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        No matching class exists in {toYear?.name}. Create these first:{" "}
                        <span className="font-mono">{preview.missingTargets.join(", ")}</span>
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Detailed pairing list */}
              {preview.mapping.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="p-3 border-b border-border bg-muted/50">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pairings</p>
                  </div>
                  <ul className="divide-y divide-border max-h-[40vh] overflow-y-auto">
                    {preview.mapping.map((m, i) => (
                      <li key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground truncate flex-1">{m.fromClassId.slice(-6)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground truncate flex-1">{m.toClassId.slice(-6)}</span>
                        <Badge variant={m.studentCount > 0 ? "default" : "secondary"} className="shrink-0">
                          {m.studentCount} student{m.studentCount === 1 ? "" : "s"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </SheetBody>

        <SheetFooter className="grid grid-cols-2 gap-2">
          {!preview ? (
            <>
              <Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button type="button" onClick={loadPreview} disabled={busy || !fromId || !toId || fromId === toId}>
                Preview
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={busy}>Back</Button>
              <Button type="button" onClick={confirm} disabled={busy || preview.totalStudents === 0}>
                <Sparkles /> {busy ? "Promoting…" : `Promote ${preview.totalStudents}`}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
