"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarCheck, ChevronRight, Crown, ShieldCheck, UserPlus, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { AddTeacherSheet } from "@/components/staff/add-teacher-sheet";
import { TeacherSheet, type TeacherProfile, type StaffOption } from "@/components/staff/teacher-sheet";
import { sheetHandoff } from "@/lib/ui/sheet-handoff";
import { cn } from "@/lib/utils";

interface StudentRow { id: string; fullName: string; gender: string | null; admissionNo: string | null }

interface Props {
  section: {
    id: string; name: string; section: string | null; academicYear: string;
    classHeadName: string | null;
    sectionLeaderId: string | null; girlsLeaderId: string | null; boysLeaderId: string | null;
    sectionLeaderName: string | null; girlsLeaderName: string | null; boysLeaderName: string | null;
  };
  teacher: TeacherProfile | null;
  teacherRole?: string;
  teacherAssignments: string[];
  students: StudentRow[];
  staff: StaffOption[];
  canManage: boolean;
}

type Tab = "ALL" | "BOYS" | "GIRLS";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function pinLeader(list: StudentRow[], leaderId: string | null) {
  if (!leaderId) return list;
  const leader = list.find(s => s.id === leaderId);
  if (!leader) return list;
  return [leader, ...list.filter(s => s.id !== leaderId)];
}

export function SectionClient({ section, teacher, teacherRole, teacherAssignments, students, staff, canManage }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [teacherSheetOpen, setTeacherSheetOpen] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [leadersOpen, setLeadersOpen] = useState(false);

  const boys = useMemo(() => students.filter(s => s.gender === "MALE"), [students]);
  const girls = useMemo(() => students.filter(s => s.gender === "FEMALE"), [students]);

  const visible = useMemo(() => {
    if (tab === "BOYS")  return pinLeader(boys, section.boysLeaderId);
    if (tab === "GIRLS") return pinLeader(girls, section.girlsLeaderId);
    return pinLeader(students, section.sectionLeaderId);
  }, [tab, students, boys, girls, section]);

  const leaderIdForTab = tab === "BOYS" ? section.boysLeaderId : tab === "GIRLS" ? section.girlsLeaderId : section.sectionLeaderId;
  const leaderLabel = tab === "BOYS" ? "Boys Leader" : tab === "GIRLS" ? "Girls Leader" : "Section Leader";
  const title = section.section ? `${section.name} — Section ${section.section}` : section.name;

  async function patchSection(payload: Record<string, string | null>, okMsg: string) {
    const res = await fetch(`/api/classes/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result.ok) { toast.error(result.error); return false; }
    toast.success(okMsg);
    router.refresh();
    return true;
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 md:p-6 md:pb-2">
        <Link href="/classes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors -ml-1 p-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Classes
        </Link>
        <div className="flex items-center justify-between gap-3 mt-1.5">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{section.academicYear}</span>
              <span>·</span>
              <span>{students.length} student{students.length === 1 ? "" : "s"}</span>
              {section.classHeadName && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Head: {section.classHeadName}</span>
                </>
              )}
            </p>
          </div>
          <Link
            href={`/attendance/${section.id}`}
            className="tap shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-xs font-bold shadow-sm active:scale-[0.96] transition-transform"
          >
            <CalendarCheck className="h-3.5 w-3.5" /> Mark
          </Link>
        </div>

        {/* Class teacher card */}
        <button
          onClick={() => setTeacherSheetOpen(true)}
          className="mt-3 w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-all hover:shadow-md active:scale-[0.99]"
        >
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
            teacher ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}>
            {teacher ? initials(teacher.fullName) : <UserPlus className="h-4.5 w-4.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Class Teacher</p>
            {teacher ? (
              <p className="text-sm font-semibold truncate mt-0.5">
                {teacher.fullName}
                {teacher.designation && <span className="text-muted-foreground font-normal"> · {teacher.designation}</span>}
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                {canManage ? "Not assigned — tap to assign" : "Not assigned"}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>

        {/* Student leadership strip */}
        <button
          onClick={() => canManage && setLeadersOpen(true)}
          disabled={!canManage}
          className={cn(
            "mt-2 w-full rounded-2xl border border-border bg-card p-3 text-left",
            canManage && "transition-all hover:shadow-md active:scale-[0.99]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-accent-foreground" /> Student leaders
            </p>
            {canManage && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <LeaderChip label="Section" name={section.sectionLeaderName} />
            <LeaderChip label="Boys" name={section.boysLeaderName} />
            <LeaderChip label="Girls" name={section.girlsLeaderName} />
          </div>
        </button>
      </div>

      {/* Gender tabs */}
      <div className="sticky top-14 md:top-0 z-30 bg-background px-4 md:px-6 py-2 border-b border-border">
        <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
          {([
            { key: "ALL" as Tab,   label: "All",   count: students.length },
            { key: "BOYS" as Tab,  label: "Boys",  count: boys.length },
            { key: "GIRLS" as Tab, label: "Girls", count: girls.length },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "tap rounded-full py-2 text-xs font-bold tracking-wide transition-all",
                tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground active:bg-card/50",
              )}
            >
              {t.label} <span className={cn("tabular-nums", tab === t.key ? "text-primary" : "")}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Students */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tab === "ALL" ? "No students in this section yet" : `No ${tab === "BOYS" ? "boys" : "girls"} in this section`}
          description={tab === "ALL" ? "Add students and assign them to this section." : "Students appear here based on the gender saved on their profile."}
          action={tab === "ALL" && canManage ? (
            <Link href="/students/new" className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold shadow-sm">
              <UserPlus className="h-3.5 w-3.5" /> Add student
            </Link>
          ) : undefined}
        />
      ) : (
        <ul className="divide-y divide-border pb-6">
          {visible.map((s, i) => {
            const isLeader = s.id === leaderIdForTab;
            return (
              <li key={s.id}>
                <Link
                  href={`/students/${s.id}`}
                  className={cn(
                    "flex items-center gap-3 px-4 md:px-6 py-3 active:bg-muted transition-colors",
                    isLeader && "bg-accent/8",
                  )}
                >
                  <span className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isLeader ? "bg-accent text-accent-foreground" : "bg-[var(--surface-2)] text-muted-foreground",
                  )}>
                    {isLeader ? <Crown className="h-4 w-4" /> : initials(s.fullName)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-2">
                      {s.fullName}
                      {isLeader && <Badge variant="accent" className="text-[10px] px-1.5 py-0">{leaderLabel}</Badge>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {s.admissionNo ? `Adm. ${s.admissionNo}` : `#${i + 1}`}
                      {s.gender ? ` · ${s.gender === "MALE" ? "Boy" : s.gender === "FEMALE" ? "Girl" : "Other"}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <TeacherSheet
        open={teacherSheetOpen}
        onOpenChange={setTeacherSheetOpen}
        contextLabel={`Class Teacher · ${title} (${section.academicYear})`}
        teacher={teacher}
        teacherRole={teacherRole}
        assignments={teacherAssignments}
        staff={staff}
        canManage={canManage}
        changeLabel="Change class teacher"
        onAssign={(id) => patchSection({ sectionTeacherId: id }, id ? "Class teacher updated" : "Class teacher removed")}
        onAddTeacher={() => sheetHandoff(() => setTeacherSheetOpen(false), () => setAddTeacherOpen(true))}
      />

      <AddTeacherSheet
        open={addTeacherOpen}
        onOpenChange={setAddTeacherOpen}
        onCreated={async (s) => { await patchSection({ sectionTeacherId: s.id }, "Class teacher assigned"); setAddTeacherOpen(false); }}
      />

      {/* Student leaders sheet */}
      <Sheet open={leadersOpen} onOpenChange={setLeadersOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh]">
          <SheetHeader>
            <SheetTitle>Student leaders · {title}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">The leader is shown first in the student list.</p>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <LeaderSelect
              label="Section Leader"
              value={section.sectionLeaderId ?? ""}
              options={students}
              onChange={(v) => patchSection({ sectionLeaderId: v || null }, "Section leader updated")}
            />
            <LeaderSelect
              label="Boys Leader"
              value={section.boysLeaderId ?? ""}
              options={boys.length ? boys : students}
              onChange={(v) => patchSection({ boysLeaderId: v || null }, "Boys leader updated")}
            />
            <LeaderSelect
              label="Girls Leader"
              value={section.girlsLeaderId ?? ""}
              options={girls.length ? girls : students}
              onChange={(v) => patchSection({ girlsLeaderId: v || null }, "Girls leader updated")}
            />
            {students.length === 0 && (
              <p className="text-xs text-muted-foreground">Add students to this section before assigning leaders.</p>
            )}
          </SheetBody>
          <SheetFooter>
            <Button onClick={() => setLeadersOpen(false)} className="w-full">Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LeaderChip({ label, name }: { label: string; name: string | null }) {
  return (
    <div className="rounded-xl bg-[var(--surface-1)] px-2.5 py-2 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-xs font-semibold truncate mt-0.5", !name && "text-muted-foreground font-normal")}>
        {name ?? "—"}
      </p>
    </div>
  );
}

function LeaderSelect({ label, value, options, onChange }: {
  label: string; value: string; options: StudentRow[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={options.length === 0}>
        <option value="">Not assigned</option>
        {options.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
      </Select>
    </div>
  );
}
