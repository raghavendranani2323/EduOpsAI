"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock, MinusCircle, MessageCircle, Copy, ChevronsDown, CloudOff, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { Terminology } from "@/lib/i18n/terminology";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { submitOrQueue } from "@/lib/offline/db";
import { notifyOfflineQueueChanged } from "@/lib/offline/use-pending-mutations";

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
  yesterdayRecords: { studentId: string; status: Status }[];
  isEdit: boolean;
  terminology: Terminology;
}

const STATUS_CYCLE: Status[] = ["PRESENT", "ABSENT", "LATE", "HALF_DAY"];

const STATUS_CONFIG: Record<Status, { label: string; full: string; color: string; bg: string; icon: React.ElementType }> = {
  PRESENT:  { label: "P",  full: "Present",  color: "text-green-700 dark:text-green-300",  bg: "bg-green-100 dark:bg-green-500/15",  icon: CheckCircle2 },
  ABSENT:   { label: "A",  full: "Absent",   color: "text-red-700 dark:text-red-300",      bg: "bg-red-100 dark:bg-red-500/15",      icon: XCircle      },
  LATE:     { label: "L",  full: "Late",     color: "text-amber-700 dark:text-amber-300",  bg: "bg-amber-100 dark:bg-amber-500/15",  icon: Clock        },
  HALF_DAY: { label: "HD", full: "Half day", color: "text-orange-700 dark:text-orange-300",bg: "bg-orange-100 dark:bg-orange-500/15",icon: MinusCircle  },
};

export function AttendanceSheet({ classId, date, students, existingRecords, yesterdayRecords, isEdit }: Props) {
  const initial = useMemo<Record<string, Status>>(() => {
    const map: Record<string, Status> = {};
    students.forEach(s => { map[s.id] = "PRESENT"; });
    existingRecords.forEach(r => { map[r.studentId] = r.status; });
    return map;
  }, [students, existingRecords]);

  const [statusMap, setStatusMap] = useState<Record<string, Status>>(initial);
  const [touched, setTouched]     = useState<Set<string>>(new Set(existingRecords.map(r => r.studentId)));
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [queued, setQueued]       = useState(false);
  const [isOnline, setIsOnline]   = useState(true);
  const [alerts, setAlerts]       = useState<Array<{ studentId: string; studentName: string; guardianName: string | null; guardianPhone: string; link: string }>>([]);
  const [notified, setNotified]   = useState<Record<string, boolean>>({});
  const [pickerStudent, setPickerStudent] = useState<AttStudent | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsOnline(navigator.onLine);
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const toggle = useCallback((studentId: string) => {
    setStatusMap(prev => {
      const cur = prev[studentId] ?? "PRESENT";
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      return { ...prev, [studentId]: next };
    });
    setTouched(prev => { const n = new Set(prev); n.add(studentId); return n; });
    setSaved(false);
    setQueued(false);
  }, []);

  const setStatus = useCallback((studentId: string, status: Status) => {
    setStatusMap(prev => ({ ...prev, [studentId]: status }));
    setTouched(prev => { const n = new Set(prev); n.add(studentId); return n; });
    setSaved(false);
    setQueued(false);
    setPickerStudent(null);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0 };
    Object.values(statusMap).forEach(s => { c[s]++; });
    return c;
  }, [statusMap]);

  const untouchedCount = students.length - touched.size;

  async function submit() {
    setSaving(true);
    const records = students.map(s => ({ studentId: s.id, status: statusMap[s.id] ?? "PRESENT" }));
    const body = { classId, date, sessionLabel: "morning", records };

    const outcome = await submitOrQueue({
      url: "/api/attendance",
      method: "POST",
      body,
      // dedupeKey ensures repeated submissions for same class+date replace each other
      // (last write wins) instead of stacking up in the queue.
      dedupeKey: `attendance:${classId}:${date}:morning`,
      description: `Attendance · ${counts.ABSENT} absent`,
    });

    setSaving(false);

    if (!outcome.ok) {
      toast.error(outcome.error || "Could not save attendance");
      return;
    }

    if (outcome.queued) {
      setQueued(true);
      setSaved(false);
      notifyOfflineQueueChanged();
      toast.info("Saved offline", {
        description: "Will sync to the server when you're back online. Safe to close this page.",
        duration: 5000,
      });
      return;
    }

    setSaved(true);
    setQueued(false);
    const result = outcome.response as { alerts?: Array<{ studentId: string; studentName: string; guardianName: string | null; guardianPhone: string; link: string }> };
    setAlerts(result.alerts ?? []);
    toast.success(isEdit ? "Attendance updated" : "Attendance saved", {
      description: `${counts.ABSENT} absent · ${counts.PRESENT} present`,
    });
  }

  function copyYesterday() {
    if (!yesterdayRecords.length) {
      toast.info("No attendance recorded yesterday");
      return;
    }
    const map: Record<string, Status> = {};
    students.forEach(s => { map[s.id] = "PRESENT"; });
    yesterdayRecords.forEach(r => { if (map[r.studentId] !== undefined) map[r.studentId] = r.status; });
    setStatusMap(map);
    setTouched(new Set(students.map(s => s.id)));
    setSaved(false);
    toast.success("Copied yesterday's attendance");
  }

  function markRestPresent() {
    setStatusMap(prev => {
      const next = { ...prev };
      students.forEach(s => { if (!touched.has(s.id)) next[s.id] = "PRESENT"; });
      return next;
    });
    setTouched(new Set(students.map(s => s.id)));
    setSaved(false);
    toast.success(`${untouchedCount} marked present`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Offline banner — only shown when navigator says offline */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-medium px-4 py-1.5 flex items-center gap-2 animate-fade-in">
          <CloudOff className="h-3.5 w-3.5" />
          <span>You&apos;re offline. Your submission will be saved on this device and sent when you reconnect.</span>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/30 text-sm overflow-x-auto scrollbar-none">
        {(Object.keys(STATUS_CONFIG) as Status[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <span key={s} className={`flex items-center gap-1 font-semibold ${cfg.color} whitespace-nowrap`}>
              <span>{counts[s]}</span>
              <span className="text-xs font-medium opacity-75">{cfg.label}</span>
            </span>
          );
        })}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background overflow-x-auto scrollbar-none">
        <Button size="sm" variant="outline" onClick={copyYesterday}>
          <Copy /> Copy yesterday
        </Button>
        {untouchedCount > 0 && (
          <Button size="sm" variant="outline" onClick={markRestPresent}>
            <ChevronsDown /> Mark rest present ({untouchedCount})
          </Button>
        )}
      </div>

      {/* Student list */}
      <div className="flex-1 overflow-y-auto pb-32">
        {students.map((student, idx) => {
          const status = statusMap[student.id] ?? "PRESENT";
          const cfg    = STATUS_CONFIG[status];
          const Icon   = cfg.icon;
          const isTouched = touched.has(student.id);

          return (
            <motion.button
              key={student.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(idx * 0.01, 0.2) }}
              onClick={() => toggle(student.id)}
              onContextMenu={(e) => { e.preventDefault(); setPickerStudent(student); }}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b text-left transition-colors active:bg-muted/60 ${status !== "PRESENT" ? "bg-red-50/40 dark:bg-red-500/5" : ""}`}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                {student.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{student.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {student.admissionNo ?? "—"}
                  {!isTouched && <span className="ml-2 text-amber-600 dark:text-amber-400">· unmarked</span>}
                </p>
              </div>
              <motion.div
                key={status}
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 480, damping: 22 }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 min-w-[64px] justify-center ${cfg.bg} ${cfg.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">{cfg.label}</span>
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      {/* Status picker (long-press) */}
      <Sheet open={!!pickerStudent} onOpenChange={(o) => !o && setPickerStudent(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{pickerStudent?.fullName}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STATUS_CONFIG) as Status[]).map(s => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <button
                    key={s}
                    onClick={() => pickerStudent && setStatus(pickerStudent.id, s)}
                    className={`flex items-center gap-3 rounded-xl border p-4 hover:border-primary/40 active:scale-[0.98] transition ${cfg.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                    <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.full}</span>
                  </button>
                );
              })}
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* Absent alerts sheet */}
      <Sheet open={saved && alerts.length > 0} onOpenChange={(o) => !o && setAlerts([])}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notify absentees</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{alerts.length} parent{alerts.length === 1 ? "" : "s"} via WhatsApp</p>
          </SheetHeader>
          <SheetBody>
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.studentId} className="flex items-center gap-3 border rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.guardianName ?? "Parent"} · {a.guardianPhone}</p>
                  </div>
                  <a
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setNotified(n => ({ ...n, [a.studentId]: true }))}
                    className={`tap flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shrink-0 transition ${
                      notified[a.studentId] ? "bg-muted text-muted-foreground" : "bg-green-600 text-white"
                    }`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {notified[a.studentId] ? "Sent" : "WhatsApp"}
                  </a>
                </div>
              ))}
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setAlerts([])}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sticky submit */}
      <div className="fixed bottom-0 inset-x-0 md:left-56 bg-card/95 backdrop-blur-md border-t p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] z-10 space-y-2">
        {queued && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-medium">
            <RefreshCw className="h-3 w-3 animate-pulse" />
            Saved offline · will sync when online
          </div>
        )}
        <Button
          onClick={submit}
          disabled={saving || saved || queued}
          size="lg"
          className="w-full h-13"
          variant={saved ? "success" : queued ? "secondary" : "default"}
        >
          {saving
            ? "Saving…"
            : saved
            ? <><CheckCircle2 /> Saved</>
            : queued
            ? <><CloudOff /> Queued · {counts.ABSENT} absent</>
            : isEdit
            ? `Update · ${counts.ABSENT} absent`
            : !isOnline
            ? `Save offline · ${counts.ABSENT} absent`
            : `Submit · ${counts.ABSENT} absent`}
        </Button>
      </div>
    </div>
  );
}
