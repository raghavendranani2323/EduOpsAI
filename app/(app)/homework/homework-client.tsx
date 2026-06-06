"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Trash2, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/format/date";

interface HW {
  id: string; classId: string; subjectId: string | null; teacherId: string;
  title: string; description: string | null; dueDate: string | null; createdAt: string;
}
interface Props {
  homework: HW[];
  classes:  { id: string; name: string }[];
  subjects: { id: string; name: string; classId: string | null }[];
}

export function HomeworkClient({ homework: initial, classes, subjects }: Props) {
  const router = useRouter();
  const [homework, setHomework] = useState(initial);
  const [open,     setOpen]     = useState(false);
  const [editing,  setEditing]  = useState<HW | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState("");
  const [form, setForm] = useState({ classId: "", subjectId: "", title: "", description: "", dueDate: "" });

  function openCreate() {
    setEditing(null);
    setForm({ classId: classes[0]?.id ?? "", subjectId: "", title: "", description: "", dueDate: "" });
    setOpen(true); setError(null);
  }
  function openEdit(h: HW) {
    setEditing(h);
    setForm({ classId: h.classId, subjectId: h.subjectId ?? "", title: h.title, description: h.description ?? "", dueDate: h.dueDate ?? "" });
    setOpen(true); setError(null);
  }

  async function save() {
    if (!form.classId || !form.title.trim()) { setError("Class and title are required"); return; }
    setSaving(true); setError(null);
    const url    = editing ? `/api/homework/${editing.id}` : "/api/homework";
    const method = editing ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, subjectId: form.subjectId || null, dueDate: form.dueDate || null }) });
    const result = await res.json();
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }

    if (editing) {
      setHomework(prev => prev.map(h => h.id === editing.id ? { ...h, ...form, subjectId: form.subjectId || null, dueDate: form.dueDate || null } : h));
    } else {
      setHomework(prev => [{ ...result.homework, dueDate: result.homework.dueDate?.split("T")[0] ?? null, createdAt: result.homework.createdAt }, ...prev]);
    }
    setOpen(false); router.refresh();
  }

  async function del(h: HW) {
    if (!confirm(`Delete "${h.title}"?`)) return;
    await fetch(`/api/homework/${h.id}`, { method: "DELETE" });
    setHomework(prev => prev.filter(x => x.id !== h.id));
  }

  const displayed = filterClass ? homework.filter(h => h.classId === filterClass) : homework;
  const classSubjects = subjects.filter(s => !s.classId || s.classId === form.classId);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Homework</h1>
          <p className="text-sm text-muted-foreground">{displayed.length} assignments</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]">
          <Plus className="h-4 w-4" /> Assign
        </button>
      </div>

      {/* Class filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterClass("")} className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!filterClass ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>All</button>
        {classes.map(c => (
          <button key={c.id} onClick={() => setFilterClass(c.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filterClass === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{c.name}</button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No homework yet</p>
          <p className="text-sm">Assign homework for a class to see it here.</p>
        </div>
      )}

      <div className="space-y-2">
        {displayed.map(h => {
          const className = classes.find(c => c.id === h.classId)?.name;
          const subjectName = subjects.find(s => s.id === h.subjectId)?.name;
          return (
            <div key={h.id} className="border rounded-xl p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{h.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {className}
                    {subjectName ? ` · ${subjectName}` : ""}
                    {h.dueDate ? ` · Due ${formatDate(new Date(h.dueDate))}` : ""}
                  </p>
                  {h.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(h)} className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => del(h)} className="p-2 rounded-lg hover:bg-destructive/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? "Edit homework" : "Assign homework"}</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Class *</label>
                  <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value, subjectId: "" }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Subject</label>
                  <select value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">All subjects</option>
                    {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Chapter 5 exercises"
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Details..."
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Due date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : editing ? "Save" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
