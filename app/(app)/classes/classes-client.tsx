"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  BookOpen, ChevronDown, GraduationCap, Pencil, Plus, ShieldCheck,
  Trash2, Users, UserPlus, Crown, Layers,
} from "lucide-react";
import type { InstitutionType } from "@prisma/client";
import { getTerminology } from "@/lib/i18n/terminology";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddTeacherSheet } from "@/components/staff/add-teacher-sheet";

const classSchema = z.object({
  name:           z.string().min(1, "Class name is required").max(80),
  academicYearId: z.string().min(1, "Pick an academic year"),
  medium:         z.string().max(40).optional(),
  classHeadId:    z.string().optional(),
});
type ClassForm = z.infer<typeof classSchema>;

const sectionSchema = z.object({
  section:          z.string().min(1, "Section name is required").max(20),
  sectionTeacherId: z.string().optional(),
});
type SectionForm = z.infer<typeof sectionSchema>;

interface StaffOption { id: string; fullName: string; role: string }
interface StudentOption { id: string; fullName: string; gender: string | null; classId: string | null }
interface Person { id: string; fullName: string; classId?: string | null }

interface ClassGroupRow {
  id: string; name: string; medium: string | null;
  classHeadId: string | null; classLeaderId: string | null;
  girlsLeaderId: string | null; boysLeaderId: string | null;
  academicYear: { id: string; name: string } | null;
  classHead: Person | null;
  classLeader: Person | null; girlsLeader: Person | null; boysLeader: Person | null;
}

interface ClassRow {
  id: string; name: string; section: string | null; academicYear: string; medium: string | null;
  classGroupId: string | null; sectionTeacherId: string | null;
  sectionLeaderId: string | null; girlsLeaderId: string | null; boysLeaderId: string | null;
  classGroup: ClassGroupRow | null;
  sectionTeacher: Person | null;
  sectionLeader: Person | null;
  girlsLeader: Person | null; boysLeader: Person | null;
  students: StudentOption[];
  _count: { students: number };
}

interface EmptyGroupRow {
  id: string;
  name: string;
  medium: string | null;
  classHeadId: string | null;
  classLeaderId: string | null;
  girlsLeaderId: string | null;
  boysLeaderId: string | null;
  academicYear: { id: string; name: string } | null;
  classHead: Person | null;
  classLeader: Person | null;
  girlsLeader: Person | null;
  boysLeader: Person | null;
}

interface AcademicYearOption { id: string; name: string; isActive: boolean }

interface Props {
  classes: ClassRow[];
  emptyGroups: EmptyGroupRow[];
  staff: StaffOption[];
  students: StudentOption[];
  institutionType: InstitutionType;
  academicYears: AcademicYearOption[];
  activeAcademicYearId: string | null;
  defaultYearName: string;
}

interface ClassGroupView {
  key: string; id: string | null; name: string; academicYear: string; medium: string | null;
  classHeadId: string | null; classLeaderId: string | null;
  girlsLeaderId: string | null; boysLeaderId: string | null;
  sections: ClassRow[];
}

function personName(id: string | null | undefined, people: Array<{ id: string; fullName: string }>) {
  if (!id) return null;
  return people.find((p) => p.id === id)?.fullName ?? null;
}

export function ClassesClient({
  classes, emptyGroups, staff: initialStaff, students, institutionType,
  academicYears: initialYears, activeAcademicYearId, defaultYearName,
}: Props) {
  const t = getTerminology(institutionType);
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);
  const [academicYears, setAcademicYears] = useState(initialYears);
  const [createYearOpen, setCreateYearOpen] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);
  const [yearForm, setYearForm] = useState({ name: defaultYearName });
  const defaultYearForClasses = activeAcademicYearId ?? academicYears[0]?.id ?? "";

  const [classSheetOpen, setClassSheetOpen]       = useState(false);
  const [editingClass, setEditingClass]           = useState<ClassGroupView | null>(null);
  const [sectionSheetGroup, setSectionSheetGroup] = useState<ClassGroupView | null>(null);
  const [editingSection, setEditingSection]       = useState<ClassRow | null>(null);
  const [leadershipGroup, setLeadershipGroup]     = useState<ClassGroupView | null>(null);
  const [leadershipSection, setLeadershipSection] = useState<ClassRow | null>(null);
  const [deletingSection, setDeletingSection]     = useState<ClassRow | null>(null);
  const [addTeacherOpen, setAddTeacherOpen]       = useState(false);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const classForm = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: { academicYearId: defaultYearForClasses },
  });
  const sectionForm = useForm<SectionForm>({ resolver: zodResolver(sectionSchema) });
  const [classSubmitting, setClassSubmitting] = useState(false);
  const [sectionSubmitting, setSectionSubmitting] = useState(false);

  const grouped = useMemo<ClassGroupView[]>(() => {
    const map = new Map<string, ClassGroupView>();
    for (const cls of classes) {
      const group = cls.classGroup;
      const key = group?.id ?? `legacy:${cls.academicYear}:${cls.name}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          id: group?.id ?? null,
          name: group?.name ?? cls.name,
          academicYear: group?.academicYear?.name ?? cls.academicYear,
          medium: group?.medium ?? cls.medium,
          classHeadId: group?.classHeadId ?? null,
          classLeaderId: group?.classLeaderId ?? null,
          girlsLeaderId: group?.girlsLeaderId ?? null,
          boysLeaderId: group?.boysLeaderId ?? null,
          sections: [],
        });
      }
      map.get(key)!.sections.push(cls);
    }
    for (const g of emptyGroups) {
      if (map.has(g.id)) continue;
      map.set(g.id, {
        key: g.id,
        id: g.id,
        name: g.name,
        academicYear: g.academicYear?.name ?? "",
        medium: g.medium,
        classHeadId: g.classHeadId,
        classLeaderId: g.classLeaderId,
        girlsLeaderId: g.girlsLeaderId,
        boysLeaderId: g.boysLeaderId,
        sections: [],
      });
    }
    return [...map.values()].sort((a, b) =>
      b.academicYear.localeCompare(a.academicYear) || a.name.localeCompare(b.name)
    );
  }, [classes, emptyGroups]);

  function fieldValue(key: string, value: string | null | undefined) {
    return localValues[key] ?? value ?? "";
  }

  function openAddClass() {
    setEditingClass(null);
    classForm.reset({ name: "", academicYearId: defaultYearForClasses, medium: "", classHeadId: "" });
    setClassSheetOpen(true);
  }

  function openAddSection(group: ClassGroupView) {
    setEditingSection(null);
    sectionForm.reset({ section: "", sectionTeacherId: "" });
    setSectionSheetGroup(group);
  }

  function openEditSection(section: ClassRow) {
    const group = grouped.find(g => g.sections.some(s => s.id === section.id)) ?? null;
    setEditingSection(section);
    sectionForm.reset({
      section: section.section ?? "",
      sectionTeacherId: section.sectionTeacherId ?? "",
    });
    setSectionSheetGroup(group);
  }

  async function onClassSubmit(data: ClassForm) {
    setClassSubmitting(true);
    try {
      const payload = { ...data, medium: data.medium?.trim() || null, classHeadId: data.classHeadId || null };
      const res = await fetch("/api/class-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${data.name} created`);
      setClassSheetOpen(false);
      router.refresh();
    } finally {
      setClassSubmitting(false);
    }
  }

  async function onSectionSubmit(data: SectionForm) {
    if (!sectionSheetGroup) return;
    setSectionSubmitting(true);
    try {
      if (editingSection) {
        const res = await fetch(`/api/classes/${editingSection.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section: data.section.trim(),
            sectionTeacherId: data.sectionTeacherId || null,
          }),
        });
        const result = await res.json();
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Section updated");
      } else {
        const res = await fetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sectionSheetGroup.name,
            classGroupId: sectionSheetGroup.id,
            academicYearId: academicYears.find(y => y.name === sectionSheetGroup.academicYear)?.id,
            medium: sectionSheetGroup.medium ?? "",
            section: data.section.trim(),
            classHeadId: sectionSheetGroup.classHeadId ?? null,
            sectionTeacherId: data.sectionTeacherId || null,
          }),
        });
        const result = await res.json();
        if (!result.ok) { toast.error(result.error); return; }
        toast.success(`Section ${data.section.trim()} added`);
      }
      setSectionSheetGroup(null);
      setEditingSection(null);
      router.refresh();
    } finally {
      setSectionSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingSection) return;
    const res = await fetch(`/api/classes/${deletingSection.id}`, { method: "DELETE" });
    const result = await res.json();
    if (!result.ok) { toast.error(result.error); return; }
    toast.success("Section deleted");
    setDeletingSection(null);
    router.refresh();
  }

  async function updateGroup(groupId: string | null, field: "classHeadId" | "classLeaderId" | "girlsLeaderId" | "boysLeaderId", value: string | null, prev: string) {
    if (!groupId) return;
    const key = `group:${groupId}:${field}`;
    setSavingKey(key);
    setLocalValues(s => ({ ...s, [key]: value ?? "" }));
    const res = await fetch(`/api/class-groups/${groupId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }),
    });
    const result = await res.json();
    setSavingKey(null);
    if (!result.ok) { setLocalValues(s => ({ ...s, [key]: prev })); toast.error(result.error); return; }
    router.refresh();
  }

  async function updateSection(sectionId: string, field: "sectionTeacherId" | "sectionLeaderId" | "girlsLeaderId" | "boysLeaderId", value: string | null, prev: string) {
    const key = `section:${sectionId}:${field}`;
    setSavingKey(key);
    setLocalValues(s => ({ ...s, [key]: value ?? "" }));
    const res = await fetch(`/api/classes/${sectionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }),
    });
    const result = await res.json();
    setSavingKey(null);
    if (!result.ok) { setLocalValues(s => ({ ...s, [key]: prev })); toast.error(result.error); return; }
    router.refresh();
  }

  function studentsForGroup(group: ClassGroupView) {
    const sectionIds = new Set(group.sections.map(s => s.id));
    return students.filter(s => s.classId && sectionIds.has(s.classId));
  }

  function leaderOptions(source: StudentOption[], gender?: "MALE" | "FEMALE") {
    const filtered = gender ? source.filter(s => s.gender === gender) : source;
    return filtered.length ? filtered : source;
  }

  function onTeacherCreated(s: { id: string; fullName: string; role: string }) {
    setStaff(prev => [...prev, s]);
    setAddTeacherOpen(false);
    router.refresh();
  }

  async function createYearInline() {
    if (!yearForm.name.match(/^\d{4}-\d{2,4}$/)) {
      toast.error("Use format YYYY-YY (e.g. 2026-27)");
      return;
    }
    setCreatingYear(true);
    try {
      const res = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: yearForm.name, setActive: academicYears.length === 0 }),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      const newYear: AcademicYearOption = {
        id: result.academicYear.id,
        name: result.academicYear.name,
        isActive: result.academicYear.isActive,
      };
      setAcademicYears(prev => [newYear, ...prev]);
      classForm.setValue("academicYearId", newYear.id, { shouldValidate: true });
      setCreateYearOpen(false);
      toast.success(`Academic year ${newYear.name} added`);
      router.refresh();
    } finally {
      setCreatingYear(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.classes}</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            {(() => {
              const activeYear = academicYears.find(y => y.id === activeAcademicYearId);
              return activeYear ? (
                <a href="/settings/academic-year" className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5 hover:bg-primary/15">
                  {activeYear.name} · Current
                </a>
              ) : (
                <a href="/settings/academic-year" className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 px-2 py-0.5 hover:bg-amber-200/60">
                  Set academic year →
                </a>
              );
            })()}
            <span>·</span>
            <span>{grouped.length === 0 ? "No classes yet" : `${grouped.length} class${grouped.length === 1 ? "" : "es"} · ${classes.length} section${classes.length === 1 ? "" : "s"}`}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" onClick={() => setAddTeacherOpen(true)}>
            <UserPlus />
            <span className="hidden sm:inline">Add teacher</span>
          </Button>
          <Button size="md" onClick={openAddClass}>
            <Plus />
            Add class
          </Button>
        </div>
      </div>

      {/* Help banner when staff missing */}
      {staff.length === 0 && grouped.length === 0 && (
        <Card className="p-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Start by adding a teacher</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Once you have a teacher you can assign them as Class Head or Section Class Teacher when you create classes.
          </p>
          <Button size="sm" className="mt-3" onClick={() => setAddTeacherOpen(true)}>
            <UserPlus /> Add your first teacher
          </Button>
        </Card>
      )}

      {/* Empty */}
      {grouped.length === 0 && staff.length > 0 && (
        <EmptyState
          icon={GraduationCap}
          title={`No ${t.classes.toLowerCase()} yet`}
          description={`Create your first ${t.class.toLowerCase()} — you can add sections to it after.`}
          action={<Button onClick={openAddClass}><Plus /> Add class</Button>}
        />
      )}

      {/* Classes list */}
      <div className="space-y-4">
        {grouped.map((group) => {
          const groupStudents = studentsForGroup(group);
          const totalStudents = group.sections.reduce((sum, s) => sum + s._count.students, 0);
          const headName = personName(group.classHeadId, staff);

          return (
            <Card key={group.key} className="overflow-hidden">
              {/* Class header row */}
              <div className="p-4 md:p-5 border-b border-border bg-[var(--surface-1)]">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-base tracking-tight">{group.name}</h2>
                      <Badge variant="outline">{group.academicYear}</Badge>
                      {group.medium && <Badge variant="secondary">{group.medium}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      <span>{group.sections.length} section{group.sections.length === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{totalStudents} student{totalStudents === 1 ? "" : "s"}</span>
                      {headName && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Class Head: {headName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setLeadershipGroup(group)}>
                    <Crown /> Class leadership
                  </Button>
                </div>
              </div>

              {/* Sections list */}
              {group.sections.length === 0 ? (
                <div className="p-5 text-center">
                  <p className="text-sm font-medium">No sections yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">Add a section like A, B, C, or Morning/Evening.</p>
                  <Button size="sm" onClick={() => openAddSection(group)}>
                    <Plus /> Add first section
                  </Button>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {group.sections.map((section) => {
                      const sectionTeacher = personName(section.sectionTeacherId, staff);
                      return (
                        <div key={section.id} className="p-4 md:p-5 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">
                                Section {section.section ?? "—"}
                              </p>
                              <Badge variant="secondary">{section._count.students} students</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {sectionTeacher ? `Class Teacher: ${sectionTeacher}` : "No Class Teacher assigned"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="iconSm" variant="ghost" onClick={() => setLeadershipSection(section)} aria-label="Leadership">
                              <Crown />
                            </Button>
                            <Button size="iconSm" variant="ghost" onClick={() => openEditSection(section)} aria-label="Edit">
                              <Pencil />
                            </Button>
                            <Button size="iconSm" variant="ghost" onClick={() => setDeletingSection(section)} aria-label="Delete" className="text-destructive hover:bg-destructive/10">
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Add another section row — always visible at the bottom of a populated list */}
                  <button
                    onClick={() => openAddSection(group)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-primary border-t border-dashed border-border hover:bg-primary/5 transition-colors active:scale-[0.99]"
                  >
                    <Plus className="h-4 w-4" />
                    Add another section to {group.name}
                  </button>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* ───────── ADD CLASS SHEET ───────── */}
      <Sheet open={classSheetOpen} onOpenChange={setClassSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh]">
          <SheetHeader>
            <SheetTitle>New class</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Just the class — you&apos;ll add sections after.</p>
          </SheetHeader>
          <form onSubmit={classForm.handleSubmit(onClassSubmit)} className="flex flex-col flex-1 min-h-0">
            <SheetBody className="space-y-5">
              <FieldRow label={`${t.class} name *`} error={classForm.formState.errors.name?.message}>
                <Input autoFocus placeholder="Class 6" {...classForm.register("name")} />
              </FieldRow>
              <div className="space-y-1.5">
                <Label>Academic year *</Label>
                {academicYears.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>No academic year set up yet</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setCreateYearOpen(true)}>
                      <Plus /> Add {defaultYearName}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Select {...classForm.register("academicYearId")}>
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>{y.name}{y.isActive ? " · Current" : ""}</option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => setCreateYearOpen(true)} className="text-xs text-primary font-medium hover:underline">
                      + Create a new academic year
                    </button>
                  </>
                )}
                {classForm.formState.errors.academicYearId && (
                  <p className="text-destructive text-xs">{classForm.formState.errors.academicYearId.message}</p>
                )}
              </div>
              <FieldRow label="Medium">
                <Input placeholder="English" {...classForm.register("medium")} />
              </FieldRow>

              <div className="space-y-1.5">
                <Label>Class Head (optional)</Label>
                {staff.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>No teachers yet</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setClassSheetOpen(false); setTimeout(() => setAddTeacherOpen(true), 200); }}>
                      <UserPlus /> Add teacher
                    </Button>
                  </div>
                ) : (
                  <>
                    <Select {...classForm.register("classHeadId")}>
                      <option value="">Not assigned</option>
                      {staff.map(m => (
                        <option key={m.id} value={m.id}>{m.fullName} · {m.role.toLowerCase()}</option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => { setClassSheetOpen(false); setTimeout(() => setAddTeacherOpen(true), 200); }} className="text-xs text-primary font-medium hover:underline">
                      + Add a new teacher
                    </button>
                  </>
                )}
              </div>
            </SheetBody>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setClassSheetOpen(false)} disabled={classSubmitting}>Cancel</Button>
              <Button type="submit" disabled={classSubmitting}>{classSubmitting ? "Creating…" : "Create class"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* ───────── ADD / EDIT SECTION SHEET ───────── */}
      <Sheet open={!!sectionSheetGroup} onOpenChange={(v) => { if (!v) { setSectionSheetGroup(null); setEditingSection(null); } }}>
        <SheetContent side="bottom" className="max-h-[92dvh]">
          <SheetHeader>
            <SheetTitle>
              {editingSection ? "Edit section" : `Add section to ${sectionSheetGroup?.name ?? ""}`}
            </SheetTitle>
            {!editingSection && sectionSheetGroup && (
              <p className="text-xs text-muted-foreground mt-0.5">Academic year {sectionSheetGroup.academicYear}</p>
            )}
          </SheetHeader>
          <form onSubmit={sectionForm.handleSubmit(onSectionSubmit)} className="flex flex-col flex-1 min-h-0">
            <SheetBody className="space-y-5">
              <FieldRow label="Section name *" error={sectionForm.formState.errors.section?.message} hint="Single letter or short label (e.g. A, B, Morning)">
                <Input autoFocus placeholder="A" {...sectionForm.register("section")} />
              </FieldRow>

              <div className="space-y-1.5">
                <Label>Section Class Teacher</Label>
                {staff.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>No teachers yet</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setSectionSheetGroup(null); setTimeout(() => setAddTeacherOpen(true), 200); }}>
                      <UserPlus /> Add teacher
                    </Button>
                  </div>
                ) : (
                  <>
                    <Select {...sectionForm.register("sectionTeacherId")}>
                      <option value="">Not assigned</option>
                      {staff.map(m => (
                        <option key={m.id} value={m.id}>{m.fullName} · {m.role.toLowerCase()}</option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => { setSectionSheetGroup(null); setTimeout(() => setAddTeacherOpen(true), 200); }} className="text-xs text-primary font-medium hover:underline">
                      + Add a new teacher
                    </button>
                  </>
                )}
              </div>
            </SheetBody>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => { setSectionSheetGroup(null); setEditingSection(null); }} disabled={sectionSubmitting}>Cancel</Button>
              <Button type="submit" disabled={sectionSubmitting}>
                {sectionSubmitting ? "Saving…" : editingSection ? "Save changes" : "Add section"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* ───────── LEADERSHIP SHEET (group level) ───────── */}
      <Sheet open={!!leadershipGroup} onOpenChange={(v) => { if (!v) setLeadershipGroup(null); }}>
        <SheetContent side="bottom" className="max-h-[88dvh]">
          <SheetHeader>
            <SheetTitle>{leadershipGroup?.name} · Leadership</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Applies to all sections of this class.</p>
          </SheetHeader>
          <SheetBody className="space-y-4">
            {leadershipGroup && (() => {
              const groupStudents = studentsForGroup(leadershipGroup);
              const classHeadVal       = fieldValue(`group:${leadershipGroup.id}:classHeadId`, leadershipGroup.classHeadId);
              const classLeaderVal     = fieldValue(`group:${leadershipGroup.id}:classLeaderId`, leadershipGroup.classLeaderId);
              const girlsLeaderVal     = fieldValue(`group:${leadershipGroup.id}:girlsLeaderId`, leadershipGroup.girlsLeaderId);
              const boysLeaderVal      = fieldValue(`group:${leadershipGroup.id}:boysLeaderId`, leadershipGroup.boysLeaderId);
              return (
                <>
                  <LeadershipField
                    label="Class Head"
                    description="A teacher who owns this entire class"
                    icon={ShieldCheck}
                    value={classHeadVal}
                    saving={savingKey === `group:${leadershipGroup.id}:classHeadId`}
                    onChange={(v) => updateGroup(leadershipGroup.id, "classHeadId", v || null, classHeadVal)}
                    options={staff.map(m => ({ id: m.id, label: `${m.fullName} · ${m.role.toLowerCase()}` }))}
                    emptyAction={
                      <button type="button" onClick={() => { setLeadershipGroup(null); setTimeout(() => setAddTeacherOpen(true), 200); }} className="text-xs text-primary font-medium hover:underline">
                        + Add a new teacher
                      </button>
                    }
                  />
                  <LeadershipField label="Class Leader" icon={Crown} description="One student to lead the entire class"
                    value={classLeaderVal}
                    saving={savingKey === `group:${leadershipGroup.id}:classLeaderId`}
                    onChange={(v) => updateGroup(leadershipGroup.id, "classLeaderId", v || null, classLeaderVal)}
                    options={groupStudents.map(s => ({ id: s.id, label: s.fullName }))}
                    disabledHint={groupStudents.length === 0 ? "Add students before assigning a leader." : undefined}
                  />
                  <LeadershipField label="Girls Leader" icon={Crown} description="Female student representative"
                    value={girlsLeaderVal}
                    saving={savingKey === `group:${leadershipGroup.id}:girlsLeaderId`}
                    onChange={(v) => updateGroup(leadershipGroup.id, "girlsLeaderId", v || null, girlsLeaderVal)}
                    options={leaderOptions(groupStudents, "FEMALE").map(s => ({ id: s.id, label: s.fullName }))}
                    disabledHint={groupStudents.length === 0 ? "Add students first." : undefined}
                  />
                  <LeadershipField label="Boys Leader" icon={Crown} description="Male student representative"
                    value={boysLeaderVal}
                    saving={savingKey === `group:${leadershipGroup.id}:boysLeaderId`}
                    onChange={(v) => updateGroup(leadershipGroup.id, "boysLeaderId", v || null, boysLeaderVal)}
                    options={leaderOptions(groupStudents, "MALE").map(s => ({ id: s.id, label: s.fullName }))}
                    disabledHint={groupStudents.length === 0 ? "Add students first." : undefined}
                  />
                </>
              );
            })()}
          </SheetBody>
          <SheetFooter>
            <Button onClick={() => setLeadershipGroup(null)} className="w-full">Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ───────── LEADERSHIP SHEET (section level) ───────── */}
      <Sheet open={!!leadershipSection} onOpenChange={(v) => { if (!v) setLeadershipSection(null); }}>
        <SheetContent side="bottom" className="max-h-[88dvh]">
          <SheetHeader>
            <SheetTitle>{leadershipSection ? `Section ${leadershipSection.section ?? "—"} · Leadership` : ""}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            {leadershipSection && (() => {
              const teacherVal = fieldValue(`section:${leadershipSection.id}:sectionTeacherId`, leadershipSection.sectionTeacherId);
              const sectionLeaderVal = fieldValue(`section:${leadershipSection.id}:sectionLeaderId`, leadershipSection.sectionLeaderId);
              const sectionGirlsVal  = fieldValue(`section:${leadershipSection.id}:girlsLeaderId`, leadershipSection.girlsLeaderId);
              const sectionBoysVal   = fieldValue(`section:${leadershipSection.id}:boysLeaderId`, leadershipSection.boysLeaderId);
              return (
                <>
                  <LeadershipField
                    label="Section Class Teacher" icon={ShieldCheck}
                    description="The teacher responsible for this section"
                    value={teacherVal}
                    saving={savingKey === `section:${leadershipSection.id}:sectionTeacherId`}
                    onChange={(v) => updateSection(leadershipSection.id, "sectionTeacherId", v || null, teacherVal)}
                    options={staff.map(m => ({ id: m.id, label: `${m.fullName} · ${m.role.toLowerCase()}` }))}
                    emptyAction={
                      <button type="button" onClick={() => { setLeadershipSection(null); setTimeout(() => setAddTeacherOpen(true), 200); }} className="text-xs text-primary font-medium hover:underline">
                        + Add a new teacher
                      </button>
                    }
                  />
                  <LeadershipField
                    label="Section Leader" icon={Crown}
                    value={sectionLeaderVal}
                    saving={savingKey === `section:${leadershipSection.id}:sectionLeaderId`}
                    onChange={(v) => updateSection(leadershipSection.id, "sectionLeaderId", v || null, sectionLeaderVal)}
                    options={leadershipSection.students.map(s => ({ id: s.id, label: s.fullName }))}
                    disabledHint={leadershipSection.students.length === 0 ? "Add students to this section first." : undefined}
                  />
                  <LeadershipField label="Girls Leader" icon={Crown}
                    value={sectionGirlsVal}
                    saving={savingKey === `section:${leadershipSection.id}:girlsLeaderId`}
                    onChange={(v) => updateSection(leadershipSection.id, "girlsLeaderId", v || null, sectionGirlsVal)}
                    options={leaderOptions(leadershipSection.students, "FEMALE").map(s => ({ id: s.id, label: s.fullName }))}
                    disabledHint={leadershipSection.students.length === 0 ? "Add students first." : undefined}
                  />
                  <LeadershipField label="Boys Leader" icon={Crown}
                    value={sectionBoysVal}
                    saving={savingKey === `section:${leadershipSection.id}:boysLeaderId`}
                    onChange={(v) => updateSection(leadershipSection.id, "boysLeaderId", v || null, sectionBoysVal)}
                    options={leaderOptions(leadershipSection.students, "MALE").map(s => ({ id: s.id, label: s.fullName }))}
                    disabledHint={leadershipSection.students.length === 0 ? "Add students first." : undefined}
                  />
                </>
              );
            })()}
          </SheetBody>
          <SheetFooter>
            <Button onClick={() => setLeadershipSection(null)} className="w-full">Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ───────── DELETE SECTION SHEET ───────── */}
      <Sheet open={!!deletingSection} onOpenChange={(v) => { if (!v) setDeletingSection(null); }}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Delete section?</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <p className="text-sm">
              <strong>Section {deletingSection?.section ?? "—"}</strong> of {deletingSection?.classGroup?.name} has{" "}
              <strong>{deletingSection?._count.students ?? 0}</strong> active students. They will be unassigned.
            </p>
          </SheetBody>
          <SheetFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setDeletingSection(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ───────── ADD TEACHER SHEET ───────── */}
      <AddTeacherSheet open={addTeacherOpen} onOpenChange={setAddTeacherOpen} onCreated={onTeacherCreated} />

      {/* ───────── INLINE CREATE ACADEMIC YEAR SHEET ───────── */}
      <Sheet open={createYearOpen} onOpenChange={setCreateYearOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>New academic year</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Format: YYYY-YY (e.g. 2026-27)</p>
          </SheetHeader>
          <SheetBody>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                autoFocus
                value={yearForm.name}
                onChange={(e) => setYearForm({ name: e.target.value })}
                placeholder={defaultYearName}
              />
              <p className="text-xs text-muted-foreground">
                {academicYears.length === 0
                  ? "This will become the current academic year."
                  : "Activate it later from Settings → Academic year."}
              </p>
            </div>
          </SheetBody>
          <SheetFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setCreateYearOpen(false)} disabled={creatingYear}>Cancel</Button>
            <Button onClick={createYearInline} disabled={creatingYear}>
              {creatingYear ? "Creating…" : "Create year"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FieldRow({ label, children, error, hint }: { label: string; children: ReactNode; error?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function LeadershipField({
  label, description, icon: Icon, value, saving, onChange, options, disabledHint, emptyAction,
}: {
  label: string;
  description?: string;
  icon: React.ElementType;
  value: string;
  saving?: boolean;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
  disabledHint?: string;
  emptyAction?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {options.length === 0 ? (
        <>
          <p className="text-xs text-muted-foreground">{disabledHint ?? "No options available."}</p>
          {emptyAction}
        </>
      ) : (
        <div className="relative">
          <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={saving}>
            <option value="">Not assigned</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          {saving && <p className="text-[11px] text-muted-foreground mt-1">Saving…</p>}
          {emptyAction}
        </div>
      )}
    </div>
  );
}
