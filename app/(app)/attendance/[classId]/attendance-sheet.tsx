"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react";
import type { Terminology } from "@/lib/i18n/terminology";

type Status = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY";

interface AttStudent {
  id: string;
  fullName: string;
  admissionNo: string | null;
  gender: string | null;
}

interface AttRecord {
  studentId: string;
  status: Status;
  note?: string;
}

interface Props {
  classId: string;
  date: string;
  students: AttStudent[];
  existingRecords: AttRecord[];
  isEdit: boolean;
  terminology: Terminology;
}

const STATUS_CYCLE: Status[] = ["PRESENT", "ABSENT", "LATE", "HALF_DAY"];

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PRESENT:  { label: "P",  color: "text-green-700",  bg: "bg-green-100",  icon: CheckCircle2 },
  ABSENT:   { label: "A",  color: "text-red-700",    bg: "bg-red-100",    icon: XCircle      },
  LATE:     { label: "L",  color: "text-amber-700",  bg: "bg-amber-100",  icon: Clock        },
  HALF_DAY: { label: "HD", color: "text-orange-700", bg: "bg-orange-100", icon: MinusCircle  },
};

export function AttendanceSheet({ classId, date, students, existingRecords, isEdit, terminology: t }: Props) {
  const initial = useMemo<{ [id: string]: Status }>(() => {
    const map: { [id: string]: Status } = {};
    students.forEach(s => { map[s.id] = "PRESENT"; });
    existingRecords.forEach(r => { map[r.studentId] = r.status; });
    return map;
  }, [students, existingRecords]);

  const [statusMap, setStatusMap] = useState<{ [id: string]: Status }>(initial);
  const [saving,  setSaving]      = useState(false);
  const [saved,   setSaved]       = useState(false);
  const [error,   setError]       = useState<string | null>(null);

  const toggle = useCallback((studentId: string) => {
    setStatusMap((prev: { [id: string]: Status }) => {
      const cur = prev[studentId] ?? "PRESENT";
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      return { ...prev, [studentId]: next };
    });
    setSaved(false);
  }, []);

  const counts = useMemo(() => {
    const c: { [K in Status]: number } = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0 };
    Object.values(statusMap).forEach(s => { c[s]++; });
    return c;
  }, [statusMap]);

  async function submit() {
    setSaving(true);
    setError(null);
    const records = students.map(s => ({ studentId: s.id, status: statusMap[s.id] ?? "PRESENT" }));
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, date, sessionLabel: "morning", records }),
    });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    setSaved(true);
    setSaving(false);
  }

  function markAll(status: Status) {
    const next: Record<string, Status> = {};
    students.forEach(s => { next[s.id] = status; });
    setStatusMap(next);
    setSaved(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex gap-3 px-4 py-3 border-b bg-muted/30 text-sm">
        {(["PRESENT", "ABSENT", "LATE", "HALF_DAY"] as Status[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <span key={s} className={`flex items-center gap-1 font-medium ${cfg.color}`}>
              <span>{counts[s]}</span>
              <span className="text-xs font-normal opacity-75">{cfg.label}</span>
            </span>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => markAll("PRESENT")}
          className="text-xs text-primary font-medium underline-offset-2 hover:underline"
        >
          All present
        </button>
      </div>

      {/* Student list */}
      <div className="flex-1 overflow-y-auto pb-28">
        {students.map(student => {
          const status = statusMap[student.id] ?? "PRESENT";
          const cfg    = STATUS_CONFIG[status];
          const Icon   = cfg.icon;

          return (
            <button
              key={student.id}
              onClick={() => toggle(student.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 border-b text-left transition-colors active:scale-[0.99] ${status !== "PRESENT" ? "bg-red-50/50" : ""}`}
            >
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                {student.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <p className="font-medium text-sm">{student.fullName}</p>
                {student.admissionNo && (
                  <p className="text-xs text-muted-foreground">{student.admissionNo}</p>
                )}
              </div>

              {/* Status badge — large tap target */}
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 min-w-[56px] justify-center ${cfg.bg} ${cfg.color}`}>
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">{cfg.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 inset-x-0 md:left-64 bg-background border-t p-4 pb-[env(safe-area-inset-bottom,16px)] space-y-2 z-10">
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        {saved && (
          <p className="text-green-700 text-sm text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Attendance saved!
          </p>
        )}
        <button
          onClick={submit}
          disabled={saving || saved}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-60 min-h-[52px]"
        >
          {saving
            ? "Saving…"
            : saved
            ? "✓ Saved"
            : isEdit
            ? `Update attendance · ${counts.ABSENT} absent`
            : `Submit attendance · ${counts.ABSENT} absent`
          }
        </button>
      </div>
    </div>
  );
}
