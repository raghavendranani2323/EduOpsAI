"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Pencil, Trash2, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/format/date";

interface Exam {
  id: string; name: string; classId: string | null; className: string | null;
  examDate: string | null; totalMarks: number; passingMarks: number;
  academicYear: string | null; resultCount: number;
}
interface Props {
  exams:    Exam[];
  classes:  { id: string; name: string }[];
  subjects: { id: string; name: string; classId: string | null }[];
  academicYears: { id: string; name: string; isActive: boolean }[];
  activeYearName: string | null;
}

const schema = z.object({
  name:         z.string().min(1, "Required"),
  classId:      z.string().optional(),
  examDate:     z.string().optional(),
  totalMarks:   z.number().min(1),
  passingMarks: z.number().min(0),
  academicYear: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function ExamsClient({ exams: initial, classes, subjects, academicYears, activeYearName }: Props) {
  const router = useRouter();
  const [exams,   setExams]   = useState(initial);
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Subjects modal
  const [openSubjects, setOpenSubjects] = useState(false);
  const [subjectList, setSubjectList]   = useState(subjects);
  const [newSubject,  setNewSubject]    = useState("");
  const [subjectClass, setSubjectClass] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { totalMarks: 100, passingMarks: 35 },
  });

  function openCreate() {
    setEditing(null);
    reset({ totalMarks: 100, passingMarks: 35, academicYear: activeYearName ?? "" });
    setOpen(true);
    setError(null);
  }
  function openEdit(e: Exam) {
    setEditing(e);
    reset({ name: e.name, classId: e.classId ?? "", examDate: e.examDate ?? "", totalMarks: e.totalMarks, passingMarks: e.passingMarks, academicYear: e.academicYear ?? "" });
    setOpen(true); setError(null);
  }
  function close() { setOpen(false); setEditing(null); setError(null); }

  async function onSubmit(data: FormData) {
    setSaving(true); setError(null);
    const payload = { ...data, classId: data.classId || null, examDate: data.examDate || null, academicYear: data.academicYear || null };
    const url    = editing ? `/api/exams/${editing.id}` : "/api/exams";
    const method = editing ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }

    if (editing) {
      const className = classes.find(c => c.id === payload.classId)?.name ?? null;
      setExams(prev => prev.map(e => e.id === editing.id ? { ...e, ...payload, className } : e));
    } else {
      const className = classes.find(c => c.id === payload.classId)?.name ?? null;
      setExams(prev => [{ ...result.exam, className, resultCount: 0 }, ...prev]);
    }
    close(); setSaving(false); router.refresh();
  }

  async function deleteExam(e: Exam) {
    if (!confirm(`Delete exam "${e.name}"? All marks will be lost.`)) return;
    await fetch(`/api/exams/${e.id}`, { method: "DELETE" });
    setExams(prev => prev.filter(x => x.id !== e.id));
  }

  async function addSubject() {
    if (!newSubject.trim()) return;
    const res = await fetch("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newSubject.trim(), classId: subjectClass || null }) });
    const result = await res.json();
    if (result.ok) { setSubjectList(prev => [...prev, result.subject]); setNewSubject(""); }
  }

  async function deleteSubject(id: string) {
    await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    setSubjectList(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Exams</h1>
          <p className="text-sm text-muted-foreground">{exams.length} exams</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpenSubjects(true)} className="border rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-muted">
            Subjects
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]">
            <Plus className="h-4 w-4" /> Add exam
          </button>
        </div>
      </div>

      {exams.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No exams yet</p>
          <p className="text-sm">Add subjects first, then create exams to enter marks.</p>
        </div>
      )}

      <div className="space-y-2">
        {exams.map(e => (
          <div key={e.id} className="border rounded-xl p-4 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {e.className ?? "All classes"}
                  {e.examDate ? ` · ${formatDate(new Date(e.examDate))}` : ""}
                  {` · ${e.totalMarks} marks (pass: ${e.passingMarks})`}
                  {e.academicYear ? ` · ${e.academicYear}` : ""}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Link
                  href={`/exams/${e.id}/marks`}
                  className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 hover:bg-primary/5 min-h-[36px]"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  {e.resultCount > 0 ? `${e.resultCount} marks` : "Enter marks"}
                </Link>
                <button onClick={() => openEdit(e)} className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
                <button onClick={() => deleteExam(e)} className="p-2 rounded-lg hover:bg-destructive/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Exam form modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? "Edit exam" : "New exam"}</h2>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Exam name *</label>
                <input {...register("name")} placeholder="Unit Test 1 / Half Yearly" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Class</label>
                  <select {...register("classId")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">All classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <input type="date" {...register("examDate")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Total marks</label>
                  <input type="number" {...register("totalMarks", { valueAsNumber: true })} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Passing marks</label>
                  <input type="number" {...register("passingMarks", { valueAsNumber: true })} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Academic year</label>
                {academicYears.length > 0 ? (
                  <select
                    {...register("academicYear")}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">— Use active year —</option>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.name}>
                        {y.name}{y.isActive ? " · Current" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...register("academicYear")}
                    placeholder="2026-27"
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                )}
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={close} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : editing ? "Save" : "Create exam"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subjects modal */}
      {openSubjects && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenSubjects(false)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Subjects</h2>
              <button onClick={() => setOpenSubjects(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {subjectList.map(s => (
                <div key={s.id} className="flex items-center gap-2 border rounded-xl px-3 py-2.5">
                  <span className="flex-1 text-sm">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{classes.find(c => c.id === s.classId)?.name ?? "All"}</span>
                  <button onClick={() => deleteSubject(s.id)} className="text-destructive hover:underline text-xs p-1">Delete</button>
                </div>
              ))}
              {subjectList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No subjects yet</p>}
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Add subject</p>
              <div className="flex gap-2">
                <input
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  placeholder="Subject name"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSubject())}
                />
                <select value={subjectClass} onChange={e => setSubjectClass(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-background">
                  <option value="">All</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={addSubject} className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium min-h-[40px]">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
