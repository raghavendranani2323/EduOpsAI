"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarCheck, Check, ChevronRight, Copy, Crown, KeyRound,
  MessageCircle, Pencil, Phone, ShieldCheck, UserPlus, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { AddTeacherSheet } from "@/components/staff/add-teacher-sheet";
import { sheetHandoff } from "@/lib/ui/sheet-handoff";
import { cn } from "@/lib/utils";

interface TeacherProfile {
  id: string; fullName: string;
  phone: string | null; email: string | null;
  designation: string | null; qualification: string | null;
}

interface StudentRow { id: string; fullName: string; gender: string | null; admissionNo: string | null }
interface StaffOption { id: string; fullName: string; role: string }

interface Credentials {
  mode: "email" | "phone";
  identifier: string;
  password: string;
  loginUrl: string;
  whatsappShare: string;
}

interface Props {
  section: {
    id: string; name: string; section: string | null; academicYear: string;
    classHeadName: string | null;
    sectionLeaderId: string | null; girlsLeaderId: string | null; boysLeaderId: string | null;
  };
  teacher: TeacherProfile | null;
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

export function SectionClient({ section, teacher, students, staff, canManage }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [teacherSheetOpen, setTeacherSheetOpen] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);

  const boys = useMemo(() => students.filter(s => s.gender === "MALE"), [students]);
  const girls = useMemo(() => students.filter(s => s.gender === "FEMALE"), [students]);

  const visible = useMemo(() => {
    if (tab === "BOYS")  return pinLeader(boys, section.boysLeaderId);
    if (tab === "GIRLS") return pinLeader(girls, section.girlsLeaderId);
    return pinLeader(students, section.sectionLeaderId);
  }, [tab, students, boys, girls, section]);

  const leaderIdForTab = tab === "BOYS" ? section.boysLeaderId : tab === "GIRLS" ? section.girlsLeaderId : section.sectionLeaderId;
  const leaderLabel = tab === "BOYS" ? "Boys Leader" : tab === "GIRLS" ? "Girls Leader" : "Section Leader";
  const title = section.section ? `${section.name} · ${section.section}` : section.name;

  async function assignTeacher(teacherId: string | null) {
    const res = await fetch(`/api/classes/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionTeacherId: teacherId }),
    });
    const result = await res.json();
    if (!result.ok) { toast.error(result.error); return false; }
    toast.success(teacherId ? "Class teacher updated" : "Class teacher removed");
    router.refresh();
    return true;
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 md:p-6 md:pb-2">
        <Link href="/classes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors -ml-1 p-1">
          <ArrowLeft className="h-3.5 w-3.5" /> All classes
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
        teacher={teacher}
        staff={staff}
        canManage={canManage}
        onAssign={assignTeacher}
        onAddTeacher={() => sheetHandoff(() => setTeacherSheetOpen(false), () => setAddTeacherOpen(true))}
      />

      <AddTeacherSheet
        open={addTeacherOpen}
        onOpenChange={setAddTeacherOpen}
        onCreated={async (s) => { await assignTeacher(s.id); setAddTeacherOpen(false); }}
      />
    </div>
  );
}

/* ───────── Teacher detail / management sheet ───────── */

function TeacherSheet({
  open, onOpenChange, teacher, staff, canManage, onAssign, onAddTeacher,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teacher: TeacherProfile | null;
  staff: StaffOption[];
  canManage: boolean;
  onAssign: (id: string | null) => Promise<boolean>;
  onAddTeacher: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", designation: "", qualification: "" });

  function startEdit() {
    if (!teacher) return;
    setForm({
      fullName: teacher.fullName,
      phone: teacher.phone ?? "",
      email: teacher.email ?? "",
      designation: teacher.designation ?? "",
      qualification: teacher.qualification ?? "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!teacher) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/staff/${teacher.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Teacher details updated");
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!teacher) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/staff/${teacher.id}/reset-password`, { method: "POST" });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      setCredentials(result.credentials);
      toast.success("New password generated");
    } finally {
      setResetting(false);
    }
  }

  function copy(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function close(v: boolean) {
    if (!v) { setEditing(false); setCredentials(null); }
    onOpenChange(v);
  }

  const waTarget = teacher?.phone?.replace(/\D/g, "") ?? "";

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="max-h-[92dvh]">
        <SheetHeader>
          <SheetTitle>{teacher ? teacher.fullName : "Assign class teacher"}</SheetTitle>
          {teacher?.designation && <p className="text-xs text-muted-foreground mt-0.5">{teacher.designation}{teacher.qualification ? ` · ${teacher.qualification}` : ""}</p>}
        </SheetHeader>
        <SheetBody className="space-y-4">

          {/* No teacher yet → pick or create */}
          {!teacher && (
            <div className="space-y-3">
              {canManage ? (
                <>
                  {staff.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Choose a teacher</Label>
                      <Select defaultValue="" onChange={async (e) => { if (e.target.value && await onAssign(e.target.value)) close(false); }}>
                        <option value="" disabled>Select…</option>
                        {staff.map(m => <option key={m.id} value={m.id}>{m.fullName} · {m.role.toLowerCase()}</option>)}
                      </Select>
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={onAddTeacher}>
                    <UserPlus /> Add a new teacher
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No class teacher has been assigned to this section yet.</p>
              )}
            </div>
          )}

          {/* Teacher details */}
          {teacher && !editing && (
            <>
              <div className="rounded-2xl border border-border bg-[var(--surface-1)] divide-y divide-border">
                {teacher.phone && (
                  <a href={`tel:${teacher.phone}`} className="flex items-center gap-3 p-3.5">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1">{teacher.phone}</span>
                    <span className="text-[11px] font-semibold text-primary">Call</span>
                  </a>
                )}
                {teacher.email && (
                  <div className="flex items-center gap-3 p-3.5">
                    <MessageCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{teacher.email}</span>
                  </div>
                )}
              </div>

              {canManage && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={startEdit}><Pencil /> Edit details</Button>
                    <Button variant="outline" onClick={resetPassword} disabled={resetting}>
                      <KeyRound /> {resetting ? "Generating…" : "Get credentials"}
                    </Button>
                  </div>

                  {/* Fresh credentials */}
                  {credentials && (
                    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-2.5 animate-fade-in">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> Login credentials
                      </p>
                      <CredRow label={credentials.mode === "email" ? "Email" : "Phone"} value={credentials.identifier} copied={copied === "id"} onCopy={() => copy(credentials.identifier, "id")} />
                      <CredRow label="Password" value={credentials.password} copied={copied === "pw"} onCopy={() => copy(credentials.password, "pw")} mono />
                      <CredRow label="Login at" value={credentials.loginUrl} copied={copied === "url"} onCopy={() => copy(credentials.loginUrl, "url")} />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => copy(credentials.whatsappShare, "all")}>
                          {copied === "all" ? <Check /> : <Copy />} Copy all
                        </Button>
                        <a
                          href={`https://wa.me/${waTarget}?text=${encodeURIComponent(credentials.whatsappShare)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--success)] text-white text-xs font-bold py-2.5 active:scale-[0.97] transition-transform"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Send on WhatsApp
                        </a>
                      </div>
                      <p className="text-[11px] text-muted-foreground">This replaces the teacher&apos;s old password. Shown only once — share it now.</p>
                    </div>
                  )}

                  {/* Change teacher */}
                  <div className="space-y-1.5 pt-1">
                    <Label>Change class teacher</Label>
                    <Select defaultValue={teacher.id} onChange={async (e) => { if (e.target.value !== teacher.id && await onAssign(e.target.value || null)) close(false); }}>
                      {staff.map(m => <option key={m.id} value={m.id}>{m.fullName} · {m.role.toLowerCase()}</option>)}
                      <option value="">Remove assignment</option>
                    </Select>
                    <button type="button" onClick={onAddTeacher} className="text-xs text-primary font-medium hover:underline">
                      + Add a new teacher instead
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Edit form */}
          {teacher && editing && (
            <div className="space-y-4">
              <Field label="Full name"><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></Field>
              <Field label="Phone"><Input inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
              <Field label="Email (optional)"><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
              <Field label="Designation"><Input placeholder="Class Teacher" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></Field>
              <Field label="Qualification"><Input placeholder="B.Ed, M.Sc" value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} /></Field>
            </div>
          )}
        </SheetBody>
        <SheetFooter className="grid grid-cols-2 gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </>
          ) : (
            <Button className="w-full col-span-2" onClick={() => close(false)}>Done</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CredRow({ label, value, copied, onCopy, mono }: { label: string; value: string; copied: boolean; onCopy: () => void; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-muted-foreground w-16 shrink-0">{label}</span>
      <span className={cn("text-sm font-medium flex-1 truncate", mono && "font-mono tracking-wide")}>{value}</span>
      <button onClick={onCopy} className="tap h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted shrink-0" aria-label={`Copy ${label}`}>
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
