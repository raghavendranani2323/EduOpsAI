"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Trophy } from "lucide-react";

interface Props {
  exam: { id: string; name: string; className: string | null; totalMarks: number; passingMarks: number; examDate: string | null };
  subjects:        { id: string; name: string }[];
  students:        { id: string; fullName: string; admissionNo: string | null }[];
  existingResults: { examId: string; studentId: string; subjectId: string; marksObtained: number | null; grade: string | null; remarks: string | null }[];
}

type MarksMap = Record<string, Record<string, string>>; // [studentId][subjectId] = marks string

function grade(marks: number, total: number, passing: number): string {
  const pct = (marks / total) * 100;
  if (marks < passing)  return "F";
  if (pct >= 90) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 60) return "B";
  if (pct >= 45) return "C";
  return "D";
}

export function MarksClient({ exam, subjects, students, existingResults }: Props) {
  const router = useRouter();

  const initial: MarksMap = {};
  students.forEach(s => {
    initial[s.id] = {};
    subjects.forEach(sub => {
      const r = existingResults.find(r => r.studentId === s.id && r.subjectId === sub.id);
      initial[s.id][sub.id] = r?.marksObtained != null ? String(r.marksObtained) : "";
    });
  });

  const [marks,   setMarks]   = useState<MarksMap>(initial);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const setMark = useCallback((studentId: string, subjectId: string, value: string) => {
    setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], [subjectId]: value } }));
    setSaved(false);
  }, []);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    const results: { studentId: string; subjectId: string; marksObtained: number | null; grade: string | null }[] = [];

    for (const s of students) {
      for (const sub of subjects) {
        const raw = marks[s.id]?.[sub.id] ?? "";
        const val = raw.trim() === "" ? null : parseFloat(raw);
        results.push({
          studentId:     s.id,
          subjectId:     sub.id,
          marksObtained: val,
          grade:         val != null ? grade(val, exam.totalMarks, exam.passingMarks) : null,
        });
      }
    }

    const res    = await fetch(`/api/exams/${exam.id}/results`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ results }),
    });
    const result = await res.json();
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setSaved(true);
    router.refresh();
  }

  // Compute totals per student
  function studentTotal(studentId: string): { total: number; count: number; pass: boolean } {
    let total = 0, count = 0, allPass = true;
    subjects.forEach(sub => {
      const raw = marks[studentId]?.[sub.id] ?? "";
      if (raw.trim() !== "") {
        const v = parseFloat(raw);
        if (!isNaN(v)) { total += v; count++; if (v < exam.passingMarks) allPass = false; }
      }
    });
    return { total, count, pass: allPass && count > 0 };
  }

  if (subjects.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-3xl">
        <div className="flex items-center gap-3">
          <Link href="/exams" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">{exam.name}</h1>
        </div>
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          <p className="font-medium">No subjects configured</p>
          <p className="text-sm mt-1">Go to Exams → Subjects to add subjects first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      <div className="flex items-center gap-3">
        <Link href="/exams" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{exam.name}</h1>
          <p className="text-sm text-muted-foreground">
            {exam.className ?? "All classes"}
            {exam.examDate ? ` · ${exam.examDate}` : ""}
            {` · ${exam.totalMarks} marks`}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 min-h-[44px]"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save marks"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {students.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          <p className="font-medium">No students in this class</p>
        </div>
      )}

      {/* Marks grid — horizontally scrollable on mobile */}
      {students.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2.5 font-medium sticky left-0 bg-muted/50 min-w-[160px]">Student</th>
                {subjects.map(sub => (
                  <th key={sub.id} className="text-center px-2 py-2.5 font-medium min-w-[100px] whitespace-nowrap">{sub.name}</th>
                ))}
                <th className="text-center px-3 py-2.5 font-medium min-w-[80px]">Total</th>
                <th className="text-center px-3 py-2.5 font-medium min-w-[60px]">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((s, idx) => {
                const { total, count, pass } = studentTotal(s.id);
                return (
                  <tr key={s.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-3 py-2 sticky left-0 bg-background border-r">
                      <p className="font-medium text-xs">{s.fullName}</p>
                      {s.admissionNo && <p className="text-xs text-muted-foreground">{s.admissionNo}</p>}
                    </td>
                    {subjects.map(sub => (
                      <td key={sub.id} className="px-2 py-1 text-center">
                        <input
                          type="number"
                          min={0}
                          max={exam.totalMarks}
                          step="0.5"
                          value={marks[s.id]?.[sub.id] ?? ""}
                          onChange={e => setMark(s.id, sub.id, e.target.value)}
                          className="w-16 text-center border rounded-lg px-1 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold">
                      {count > 0 ? total.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {count > 0 ? (
                        <span className={`text-xs font-semibold flex items-center justify-center gap-1 ${pass ? "text-green-700" : "text-destructive"}`}>
                          {pass ? <Trophy className="h-3 w-3" /> : "✗"}
                          {pass ? "Pass" : "Fail"}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky save on mobile */}
      <div className="fixed bottom-0 inset-x-0 md:left-64 p-3 bg-background border-t md:hidden" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save marks"}
        </button>
      </div>
    </div>
  );
}
