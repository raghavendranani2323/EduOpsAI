"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Calendar, Plus, Pencil, Trash2, CheckCircle2, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";

const createSchema = z.object({
  name:      z.string().regex(/^\d{4}-\d{2,4}$/, "Use YYYY-YY (e.g. 2026-27)"),
  startsOn:  z.string().optional(),
  endsOn:    z.string().optional(),
  setActive: z.boolean().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name:     z.string().regex(/^\d{4}-\d{2,4}$/, "Use YYYY-YY (e.g. 2026-27)"),
  startsOn: z.string().optional(),
  endsOn:   z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

interface YearRow {
  id: string;
  name: string;
  startsOn: string | null;
  endsOn:   string | null;
  isActive: boolean;
  classCount: number;
}

interface Props {
  years: YearRow[];
  studentCount: number;
  defaultName: string;
  canEdit: boolean;
}

export function AcademicYearClient({ years, studentCount, defaultName, canEdit }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen]   = useState(false);
  const [editing, setEditing]         = useState<YearRow | null>(null);
  const [deleting, setDeleting]       = useState<YearRow | null>(null);
  const [activating, setActivating]   = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: defaultName, setActive: years.length === 0 },
  });
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const activeYear = years.find(y => y.isActive) ?? null;

  function openCreate() {
    createForm.reset({ name: defaultName, setActive: years.length === 0 });
    setCreateOpen(true);
  }

  function openEdit(y: YearRow) {
    editForm.reset({
      name: y.name,
      startsOn: y.startsOn ?? "",
      endsOn:   y.endsOn   ?? "",
    });
    setEditing(y);
  }

  async function onCreate(data: CreateForm) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`Academic year ${data.name} created`);
      setCreateOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function onEdit(data: EditForm) {
    if (!editing) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/academic-years/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Updated");
      setEditing(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function activate(y: YearRow) {
    if (y.isActive) return;
    setActivating(y.id);
    try {
      const res = await fetch(`/api/academic-years/${y.id}/activate`, { method: "POST" });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${y.name} is now the current academic year`);
      router.refresh();
    } finally {
      setActivating(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/academic-years/${deleting.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Deleted");
      setDeleting(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic years</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick the current academic year. Every class, invoice and exam will use it by default.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} size="md">
            <Plus /> Add year
          </Button>
        )}
      </div>

      {/* Current year banner */}
      {activeYear ? (
        <Card className="p-5 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Current academic year</p>
              </div>
              <p className="text-2xl font-bold tracking-tight mt-1">{activeYear.name}</p>
              {(activeYear.startsOn || activeYear.endsOn) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {activeYear.startsOn ?? "—"} → {activeYear.endsOn ?? "—"}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {activeYear.classCount} class{activeYear.classCount === 1 ? "" : "es"} · {studentCount} active student{studentCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">No active academic year</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Create one to start adding classes and tracking attendance. We&apos;ve pre-filled the form with {defaultName}.
              </p>
              {canEdit && (
                <Button size="sm" className="mt-3" onClick={openCreate}>
                  <Plus /> Create {defaultName}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* All years */}
      {years.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No academic years yet"
          description="Add your first academic year — most Indian schools use April → March (e.g. 2026-27)."
          action={canEdit ? <Button onClick={openCreate}><Plus /> Add academic year</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All years</p>
          {years.map(y => (
            <Card key={y.id} className="overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  y.isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-base tracking-tight">{y.name}</p>
                    {y.isActive && <Badge variant="success" className="font-bold">Current</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {y.classCount} class{y.classCount === 1 ? "" : "es"}
                    {y.startsOn && <span> · {y.startsOn} → {y.endsOn ?? "—"}</span>}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    {!y.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => activate(y)}
                        disabled={activating === y.id}
                      >
                        {activating === y.id ? "…" : (
                          <>
                            <CheckCircle2 /> Set current
                          </>
                        )}
                      </Button>
                    )}
                    <Button size="iconSm" variant="ghost" onClick={() => openEdit(y)} aria-label="Edit">
                      <Pencil />
                    </Button>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      onClick={() => setDeleting(y)}
                      disabled={y.classCount > 0 || y.isActive}
                      aria-label="Delete"
                      className="text-destructive hover:bg-destructive/10 disabled:opacity-30"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Help / next steps */}
      {activeYear && (
        <Card className="p-4 bg-[var(--surface-1)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Next steps</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href="/classes" className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted transition-colors active:scale-[0.99]">
              <span className="text-sm font-medium">Set up classes for {activeYear.name}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </a>
            <a href="/students/new" className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted transition-colors active:scale-[0.99]">
              <span className="text-sm font-medium">Enroll students</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </Card>
      )}

      {/* CREATE SHEET */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh]">
          <SheetHeader>
            <SheetTitle>New academic year</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">India typically uses April → March. Format: YYYY-YY.</p>
          </SheetHeader>
          <form onSubmit={createForm.handleSubmit(onCreate)} className="flex flex-col flex-1 min-h-0">
            <SheetBody className="space-y-5">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input placeholder="2026-27" autoFocus {...createForm.register("name")} />
                {createForm.formState.errors.name && (
                  <p className="text-destructive text-xs">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Starts on</Label>
                  <Input type="date" {...createForm.register("startsOn")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends on</Label>
                  <Input type="date" {...createForm.register("endsOn")} />
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" {...createForm.register("setActive")} className="h-4 w-4" />
                <span className="text-sm font-medium">Make this the current academic year</span>
              </label>
            </SheetBody>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create year"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT SHEET */}
      <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Edit {editing?.name}</SheetTitle>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="flex flex-col flex-1 min-h-0">
            <SheetBody className="space-y-5">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input {...editForm.register("name")} />
                {editForm.formState.errors.name && (
                  <p className="text-destructive text-xs">{editForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Starts on</Label>
                  <Input type="date" {...editForm.register("startsOn")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends on</Label>
                  <Input type="date" {...editForm.register("endsOn")} />
                </div>
              </div>
            </SheetBody>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* DELETE SHEET */}
      <Sheet open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Delete {deleting?.name}?</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <p className="text-sm">
              This academic year has no classes attached, so it can be safely removed.
            </p>
          </SheetBody>
          <SheetFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={submitting}>
              {submitting ? "Deleting…" : "Delete"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
