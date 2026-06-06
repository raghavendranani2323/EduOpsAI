"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, Pencil, Trash2, X } from "lucide-react";
import type { InstitutionType } from "@prisma/client";
import { getTerminology } from "@/lib/i18n/terminology";

const schema = z.object({
  name:         z.string().min(1, "Name is required"),
  section:      z.string().optional(),
  academicYear: z.string().min(1, "Academic year is required"),
});
type FormData = z.infer<typeof schema>;

interface ClassRow {
  id: string;
  name: string;
  section: string | null;
  academicYear: string;
  _count: { students: number };
}

interface Props {
  classes: ClassRow[];
  institutionType: InstitutionType;
}

export function ClassesClient({ classes: initial, institutionType }: Props) {
  const t   = getTerminology(institutionType);
  const router = useRouter();

  const [classes, setClasses]   = useState(initial);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: "2025-26" },
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", section: "", academicYear: "2025-26" });
    setOpen(true);
    setError(null);
  }

  function openEdit(cls: ClassRow) {
    setEditing(cls);
    reset({ name: cls.name, section: cls.section ?? "", academicYear: cls.academicYear });
    setOpen(true);
    setError(null);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setError(null);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `/api/classes/${editing.id}` : "/api/classes";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.ok) { setError(result.error); return; }

      if (editing) {
        setClasses(prev => prev.map(c => c.id === editing.id ? { ...c, ...data } : c));
      } else {
        setClasses(prev => [...prev, { ...result.class, _count: { students: 0 } }]);
      }
      closeModal();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${deleting.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.ok) { setError(result.error); return; }
      setClasses(prev => prev.filter(c => c.id !== deleting.id));
      setDeleting(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.classes}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{classes.length} {t.classes.toLowerCase()}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          Add {t.class}
        </button>
      </div>

      {classes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {t.classes.toLowerCase()} yet</p>
          <p className="text-sm">Add your first {t.class.toLowerCase()} to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {classes.map((cls) => (
          <div key={cls.id} className="flex items-center gap-3 border rounded-xl p-3.5 bg-card">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{cls.name}{cls.section ? ` — ${cls.section}` : ""}</p>
              <p className="text-xs text-muted-foreground">{cls._count.students} {t.students.toLowerCase()} · {cls.academicYear}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => openEdit(cls)}
                className="p-2 rounded-lg hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setDeleting(cls)}
                className="p-2 rounded-lg hover:bg-destructive/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? `Edit ${t.class}` : `New ${t.class}`}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t.class} name *</label>
                <input
                  {...register("name")}
                  placeholder={`e.g. ${t.class} 6`}
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Section (optional)</label>
                <input
                  {...register("section")}
                  placeholder="e.g. A, B, Science"
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Academic year *</label>
                <input
                  {...register("academicYear")}
                  placeholder="2025-26"
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {errors.academicYear && <p className="text-destructive text-xs mt-1">{errors.academicYear.message}</p>}
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]"
                >
                  {saving ? "Saving…" : editing ? "Save changes" : `Add ${t.class}`}
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
            <h2 className="font-semibold">Delete {t.class}?</h2>
            <p className="text-sm text-muted-foreground">
              <strong>{deleting.name}</strong> has <strong>{deleting._count.students}</strong> {t.students.toLowerCase()}. Deleting it will unassign them.
            </p>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="flex-1 bg-destructive text-destructive-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
