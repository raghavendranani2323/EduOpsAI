"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Calendar } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Slot {
  id: string; institutionId: string; classId: string; subjectId: string | null;
  teacherId: string | null; dayOfWeek: number; startTime: string; endTime: string; label: string | null;
}
interface Props {
  slots:    Slot[];
  classes:  { id: string; name: string }[];
  subjects: { id: string; name: string; classId: string | null }[];
}

export function TimetableClient({ slots: initial, classes, subjects }: Props) {
  const router = useRouter();
  const [slots,      setSlots]      = useState(initial);
  const [classId,    setClassId]    = useState(classes[0]?.id ?? "");
  const [open,       setOpen]       = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: "09:00", endTime: "09:45", subjectId: "", label: "" });

  const filtered = slots.filter(s => s.classId === classId);
  const classSubjects = subjects.filter(s => !s.classId || s.classId === classId);

  function openAdd() { setForm({ dayOfWeek: 1, startTime: "09:00", endTime: "09:45", subjectId: "", label: "" }); setOpen(true); setError(null); }

  async function save() {
    if (!classId) return;
    setSaving(true); setError(null);
    const res = await fetch("/api/timetable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, ...form, dayOfWeek: Number(form.dayOfWeek), subjectId: form.subjectId || null }),
    });
    const result = await res.json();
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setSlots(prev => [...prev, result.slot]);
    setOpen(false);
    router.refresh();
  }

  async function deleteSlot(id: string) {
    await fetch(`/api/timetable/${id}`, { method: "DELETE" });
    setSlots(prev => prev.filter(s => s.id !== id));
  }

  const slotsByDay: Record<number, Slot[]> = {};
  for (let d = 1; d <= 6; d++) {
    slotsByDay[d] = filtered.filter(s => s.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Timetable</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} slots</p>
        </div>
        <button onClick={openAdd} disabled={!classId} className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] disabled:opacity-50">
          <Plus className="h-4 w-4" /> Add slot
        </button>
      </div>

      {/* Class picker */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {classes.map(c => (
          <button
            key={c.id}
            onClick={() => setClassId(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${classId === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {classes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No classes yet</p>
          <p className="text-sm">Add classes in Students → Classes first.</p>
        </div>
      )}

      {/* Weekly grid */}
      {classId && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map(day => (
            <div key={day} className="border rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 font-semibold text-sm">{DAYS[day - 1]}</div>
              {slotsByDay[day].length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground italic">No periods</p>
              ) : (
                <div className="divide-y">
                  {slotsByDay[day].map(slot => {
                    const subName = subjects.find(s => s.id === slot.subjectId)?.name;
                    return (
                      <div key={slot.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs text-muted-foreground w-24 shrink-0">{slot.startTime} – {slot.endTime}</span>
                        <span className="flex-1 text-sm font-medium">{slot.label || subName || "Period"}</span>
                        {subName && !slot.label && null}
                        {slot.label && subName && <span className="text-xs text-muted-foreground">{subName}</span>}
                        <button onClick={() => deleteSlot(slot.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add slot modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Add period</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Day</label>
                <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {DAYS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start time</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End time</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject (optional)</label>
                <select value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">— None —</option>
                  {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Label (optional, e.g. "Lunch Break")</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Period label"
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : "Add period"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
