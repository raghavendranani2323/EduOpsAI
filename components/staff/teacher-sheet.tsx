"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, KeyRound, MessageCircle, Pencil, Phone, UserPlus, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";

export interface TeacherProfile {
  id: string; fullName: string;
  phone: string | null; email: string | null;
  designation: string | null; qualification: string | null;
}

export interface StaffOption { id: string; fullName: string; role: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Sheet heading context, e.g. "Class Teacher · Class 6 — Section A" */
  contextLabel: string;
  teacher: TeacherProfile | null;
  /** Role of this teacher in the institution (TEACHER/ADMIN/OWNER) — controls password reset */
  teacherRole?: string;
  /** Everything this person handles, e.g. ["Class Head · Class 6", "Class Teacher · Class 6 — A"] */
  assignments?: string[];
  staff: StaffOption[];
  canManage: boolean;
  changeLabel: string;
  onAssign: (id: string | null) => Promise<boolean>;
  onAddTeacher: () => void;
}

export function TeacherSheet({
  open, onOpenChange, contextLabel, teacher, teacherRole, assignments = [],
  staff, canManage, changeLabel, onAssign, onAddTeacher,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", designation: "", qualification: "" });

  const canReset = teacherRole === "TEACHER";

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
      toast.success("Details updated");
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
      setConfirmingReset(false);
      toast.success(result.message ?? "Password recovery started");
    } finally {
      setResetting(false);
    }
  }

  function close(v: boolean) {
    if (!v) { setEditing(false); setConfirmingReset(false); }
    onOpenChange(v);
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="max-h-[92dvh]">
        <SheetHeader>
          <SheetTitle>{teacher ? teacher.fullName : `Assign ${changeLabel.toLowerCase()}`}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{contextLabel}</p>
        </SheetHeader>
        <SheetBody className="space-y-4">

          {/* No teacher yet */}
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
                <p className="text-sm text-muted-foreground">Not assigned yet.</p>
              )}
            </div>
          )}

          {/* Details view */}
          {teacher && !editing && (
            <>
              {(teacher.designation || teacher.qualification) && (
                <p className="text-sm text-muted-foreground -mt-1">
                  {[teacher.designation, teacher.qualification].filter(Boolean).join(" · ")}
                </p>
              )}

              {/* Everything this teacher handles */}
              {assignments.length > 0 && (
                <div className="rounded-2xl border border-border bg-[var(--surface-1)] p-3.5 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> Responsibilities
                  </p>
                  <ul className="space-y-1">
                    {assignments.map(a => (
                      <li key={a} className="text-sm font-medium flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                    <Button
                      variant="outline"
                      onClick={() => canReset ? setConfirmingReset(true) : toast.info("Admins and owners reset their own password from the login page.")}
                      disabled={resetting}
                    >
                      <KeyRound /> Login credentials
                    </Button>
                  </div>

                  {/* Confirm before resetting — the old password stops working */}
                  {confirmingReset && (
                    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 space-y-3 animate-fade-in">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning shrink-0" /> Start password recovery?
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        We will send a secure recovery email to the teacher. EduOps will not show or share a password here.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => setConfirmingReset(false)} disabled={resetting}>Cancel</Button>
                        <Button size="sm" onClick={resetPassword} disabled={resetting}>
                          {resetting ? "Sending..." : "Send recovery email"}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <Label>{changeLabel}</Label>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
