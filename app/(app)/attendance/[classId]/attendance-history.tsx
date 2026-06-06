"use client";

import { formatDateLong } from "@/lib/format/date";
import type { Terminology } from "@/lib/i18n/terminology";

interface DaySummary {
  date: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  total: number;
}

interface Props {
  history: DaySummary[];
  className: string;
  terminology: Terminology;
}

export function AttendanceHistory({ history, className: clsName, terminology: t }: Props) {
  if (history.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground p-4">
        <p className="font-medium">No attendance history</p>
        <p className="text-sm">Attendance has not been marked for {clsName} yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground font-medium">Last {history.length} days</p>
      <div className="border rounded-xl overflow-hidden">
        {history.map((day, i) => {
          const pct = day.total > 0 ? Math.round((day.present / day.total) * 100) : 0;
          return (
            <div key={day.date} className={`flex items-center gap-3 px-4 py-3 ${i < history.length - 1 ? "border-b" : ""}`}>
              <div className="w-24 shrink-0">
                <p className="text-sm font-medium">{formatDateLong(day.date)}</p>
              </div>
              <div className="flex-1 flex items-center gap-2">
                {/* Attendance bar */}
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-8 text-right ${pct >= 80 ? "text-green-700" : pct >= 60 ? "text-amber-700" : "text-red-700"}`}>
                  {pct}%
                </span>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground w-24 justify-end">
                <span className="text-green-700 font-medium">{day.present}P</span>
                {day.absent  > 0 && <span className="text-red-700 font-medium">{day.absent}A</span>}
                {day.late    > 0 && <span className="text-amber-700 font-medium">{day.late}L</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
