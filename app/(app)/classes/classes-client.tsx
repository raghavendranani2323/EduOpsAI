"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BookOpen,
  GraduationCap,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { InstitutionType } from "@prisma/client";
import { getTerminology } from "@/lib/i18n/terminology";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  section: z.string().optional(),
  academicYear: z.string().min(1, "Academic year is required"),
  medium: z.string().optional(),
  classHeadId: z.string().optional(),
  sectionTeacherId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface StaffOption {
  id: string;
  fullName: string;
  role: string;
}

interface StudentOption {
  id: string;
  fullName: string;
  gender: string | null;
  classId: string | null;
}

interface Person {
  id: string;
  fullName: string;
  classId?: string | null;
}

interface ClassGroupRow {
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

interface ClassRow {
  id: string;
  name: string;
  section: string | null;
  academicYear: string;
  medium: string | null;
  classGroupId: string | null;
  sectionTeacherId: string | null;
  sectionLeaderId: string | null;
  girlsLeaderId: string | null;
  boysLeaderId: string | null;
  classGroup: ClassGroupRow | null;
  sectionTeacher: Person | null;
  sectionLeader: Person | null;
  girlsLeader: Person | null;
  boysLeader: Person | null;
  students: StudentOption[];
  _count: { students: number };
}

interface Props {
  classes: ClassRow[];
  staff: StaffOption[];
  students: StudentOption[];
  institutionType: InstitutionType;
}

interface ClassGroupView {
  key: string;
  id: string | null;
  name: string;
  academicYear: string;
  medium: string | null;
  classHeadId: string | null;
  classLeaderId: string | null;
  girlsLeaderId: string | null;
  boysLeaderId: string | null;
  sections: ClassRow[];
}

const DEFAULT_YEAR = "2026-27";

function personName(id: string | null | undefined, people: Array<{ id: string; fullName: string }>) {
  if (!id) return "Not assigned";
  return people.find((p) => p.id === id)?.fullName ?? "Not assigned";
}

function displaySection(cls: ClassRow) {
  return cls.section ? `${cls.name}-${cls.section}` : cls.name;
}

export function ClassesClient({ classes, staff, students, institutionType }: Props) {
  const t = getTerminology(institutionType);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: DEFAULT_YEAR },
  });

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
    return [...map.values()].sort((a, b) =>
      b.academicYear.localeCompare(a.academicYear) || a.name.localeCompare(b.name)
    );
  }, [classes]);

  function openCreate() {
    setEditing(null);
    reset({ name: "", section: "", academicYear: DEFAULT_YEAR, medium: "", classHeadId: "", sectionTeacherId: "" });
    setOpen(true);
    setError(null);
  }

  function openEdit(cls: ClassRow) {
    setEditing(cls);
    reset({
      name: cls.name,
      section: cls.section ?? "",
      academicYear: cls.academicYear,
      medium: cls.medium ?? cls.classGroup?.medium ?? "",
      classHeadId: cls.classGroup?.classHeadId ?? "",
      sectionTeacherId: cls.sectionTeacherId ?? "",
    });
    setOpen(true);
    setError(null);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setError(null);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...data,
        medium: data.medium?.trim() || null,
        classHeadId: data.classHeadId || null,
        sectionTeacherId: data.sectionTeacherId || null,
      };
      const url = editing ? `/api/classes/${editing.id}` : "/api/classes";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeModal();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${deleting.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDeleting(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function fieldValue(key: string, value: string | null | undefined) {
    return localValues[key] ?? value ?? "";
  }

  function rollbackField(key: string, previousValue: string) {
    setLocalValues((current) => ({ ...current, [key]: previousValue }));
  }

  async function updateGroup(
    groupId: string | null,
    field: "classHeadId" | "classLeaderId" | "girlsLeaderId" | "boysLeaderId",
    value: string | null,
    previousValue: string
  ) {
    if (!groupId) return;
    const key = `group:${groupId}:${field}`;
    setSavingKey(key);
    setLocalValues((current) => ({ ...current, [key]: value ?? "" }));
    setError(null);
    try {
      const res = await fetch(`/api/class-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const result = await res.json();
      if (!result.ok) {
        rollbackField(key, previousValue);
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setSavingKey(null);
    }
  }

  async function updateSection(
    sectionId: string,
    field: "sectionTeacherId" | "sectionLeaderId" | "girlsLeaderId" | "boysLeaderId",
    value: string | null,
    previousValue: string
  ) {
    const key = `section:${sectionId}:${field}`;
    setSavingKey(key);
    setLocalValues((current) => ({ ...current, [key]: value ?? "" }));
    setError(null);
    try {
      const res = await fetch(`/api/classes/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const result = await res.json();
      if (!result.ok) {
        rollbackField(key, previousValue);
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setSavingKey(null);
    }
  }

  function studentsForGroup(group: ClassGroupView) {
    const sectionIds = new Set(group.sections.map((section) => section.id));
    return students.filter((student) => student.classId && sectionIds.has(student.classId));
  }

  function leaderOptions(source: StudentOption[], gender?: "MALE" | "FEMALE") {
    const filtered = gender ? source.filter((student) => student.gender === gender) : source;
    return filtered.length ? filtered : source;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.classes}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {grouped.length} class groups · {classes.length} sections
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          Add section
        </button>
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {classes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {t.classes.toLowerCase()} yet</p>
          <p className="text-sm">Add your first section to build class leadership.</p>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map((group) => {
          const groupStudents = studentsForGroup(group);
          const totalStudents = group.sections.reduce((sum, section) => sum + section._count.students, 0);
          const classHeadKey = `group:${group.id}:classHeadId`;
          const classLeaderKey = `group:${group.id}:classLeaderId`;
          const classGirlsLeaderKey = `group:${group.id}:girlsLeaderId`;
          const classBoysLeaderKey = `group:${group.id}:boysLeaderId`;
          const classHeadValue = fieldValue(classHeadKey, group.classHeadId);
          const classLeaderValue = fieldValue(classLeaderKey, group.classLeaderId);
          const classGirlsLeaderValue = fieldValue(classGirlsLeaderKey, group.girlsLeaderId);
          const classBoysLeaderValue = fieldValue(classBoysLeaderKey, group.boysLeaderId);
          return (
            <section key={group.key} className="border rounded-lg bg-card overflow-hidden">
              <div className="p-4 border-b bg-muted/30 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{group.name}</h2>
                      <span className="text-xs border rounded-full px-2 py-0.5">{group.academicYear}</span>
                      {group.medium && <span className="text-xs border rounded-full px-2 py-0.5">{group.medium}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {group.sections.length} sections · {totalStudents} active students
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <SelectField
                    label="Class Head"
                    value={classHeadValue}
                    disabled={!group.id}
                    saving={savingKey === `group:${group.id}:classHeadId`}
                    onChange={(value) => updateGroup(group.id, "classHeadId", value || null, classHeadValue)}
                  >
                    <option value="">Not assigned</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>{member.fullName} ({member.role.toLowerCase()})</option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Class Leader"
                    value={classLeaderValue}
                    disabled={!group.id || groupStudents.length === 0}
                    saving={savingKey === `group:${group.id}:classLeaderId`}
                    onChange={(value) => updateGroup(group.id, "classLeaderId", value || null, classLeaderValue)}
                  >
                    <option value="">Not assigned</option>
                    {groupStudents.map((student) => (
                      <option key={student.id} value={student.id}>{student.fullName}</option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Girls Leader"
                    value={classGirlsLeaderValue}
                    disabled={!group.id || groupStudents.length === 0}
                    saving={savingKey === `group:${group.id}:girlsLeaderId`}
                    onChange={(value) => updateGroup(group.id, "girlsLeaderId", value || null, classGirlsLeaderValue)}
                  >
                    <option value="">Not assigned</option>
                    {leaderOptions(groupStudents, "FEMALE").map((student) => (
                      <option key={student.id} value={student.id}>{student.fullName}</option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Boys Leader"
                    value={classBoysLeaderValue}
                    disabled={!group.id || groupStudents.length === 0}
                    saving={savingKey === `group:${group.id}:boysLeaderId`}
                    onChange={(value) => updateGroup(group.id, "boysLeaderId", value || null, classBoysLeaderValue)}
                  >
                    <option value="">Not assigned</option>
                    {leaderOptions(groupStudents, "MALE").map((student) => (
                      <option key={student.id} value={student.id}>{student.fullName}</option>
                    ))}
                  </SelectField>
                </div>
              </div>

              <div className="divide-y">
                {group.sections.map((section) => {
                  const sectionTeacherKey = `section:${section.id}:sectionTeacherId`;
                  const sectionLeaderKey = `section:${section.id}:sectionLeaderId`;
                  const sectionGirlsLeaderKey = `section:${section.id}:girlsLeaderId`;
                  const sectionBoysLeaderKey = `section:${section.id}:boysLeaderId`;
                  const sectionTeacherValue = fieldValue(sectionTeacherKey, section.sectionTeacherId);
                  const sectionLeaderValue = fieldValue(sectionLeaderKey, section.sectionLeaderId);
                  const sectionGirlsLeaderValue = fieldValue(sectionGirlsLeaderKey, section.girlsLeaderId);
                  const sectionBoysLeaderValue = fieldValue(sectionBoysLeaderKey, section.boysLeaderId);

                  return (
                  <div key={section.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{displaySection(section)}</p>
                        <p className="text-xs text-muted-foreground">
                          {section._count.students} students · Section Class Teacher: {personName(section.sectionTeacherId, staff)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(section)}
                          className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label="Edit section"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => setDeleting(section)}
                          className="p-2 rounded-lg hover:bg-destructive/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label="Delete section"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <SelectField
                        label="Section Class Teacher"
                        value={sectionTeacherValue}
                        saving={savingKey === `section:${section.id}:sectionTeacherId`}
                        onChange={(value) => updateSection(section.id, "sectionTeacherId", value || null, sectionTeacherValue)}
                      >
                        <option value="">Not assigned</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>{member.fullName} ({member.role.toLowerCase()})</option>
                        ))}
                      </SelectField>

                      <SelectField
                        label="Section Leader"
                        value={sectionLeaderValue}
                        disabled={section.students.length === 0}
                        saving={savingKey === `section:${section.id}:sectionLeaderId`}
                        onChange={(value) => updateSection(section.id, "sectionLeaderId", value || null, sectionLeaderValue)}
                      >
                        <option value="">Not assigned</option>
                        {section.students.map((student) => (
                          <option key={student.id} value={student.id}>{student.fullName}</option>
                        ))}
                      </SelectField>

                      <SelectField
                        label="Girls Leader"
                        value={sectionGirlsLeaderValue}
                        disabled={section.students.length === 0}
                        saving={savingKey === `section:${section.id}:girlsLeaderId`}
                        onChange={(value) => updateSection(section.id, "girlsLeaderId", value || null, sectionGirlsLeaderValue)}
                      >
                        <option value="">Not assigned</option>
                        {leaderOptions(section.students, "FEMALE").map((student) => (
                          <option key={student.id} value={student.id}>{student.fullName}</option>
                        ))}
                      </SelectField>

                      <SelectField
                        label="Boys Leader"
                        value={sectionBoysLeaderValue}
                        disabled={section.students.length === 0}
                        saving={savingKey === `section:${section.id}:boysLeaderId`}
                        onChange={(value) => updateSection(section.id, "boysLeaderId", value || null, sectionBoysLeaderValue)}
                      >
                        <option value="">Not assigned</option>
                        {leaderOptions(section.students, "MALE").map((student) => (
                          <option key={student.id} value={student.id}>{student.fullName}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-lg w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? "Edit section" : "New class section"}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t.class} name *</label>
                  <input
                    {...register("name")}
                    placeholder="Class 6"
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Section</label>
                  <input
                    {...register("section")}
                    placeholder="A"
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Academic year *</label>
                  <input
                    {...register("academicYear")}
                    placeholder={DEFAULT_YEAR}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {errors.academicYear && <p className="text-destructive text-xs mt-1">{errors.academicYear.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Medium</label>
                  <input
                    {...register("medium")}
                    placeholder="English"
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <section className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Teacher responsibility</h3>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Class Head (all sections)</label>
                  <select
                    {...register("classHeadId")}
                    disabled={staff.length === 0}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                  >
                    <option value="">Not assigned</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>{member.fullName} ({member.role.toLowerCase()})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Section Class Teacher</label>
                  <select
                    {...register("sectionTeacherId")}
                    disabled={staff.length === 0}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                  >
                    <option value="">Not assigned</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>{member.fullName} ({member.role.toLowerCase()})</option>
                    ))}
                  </select>
                </div>
              </section>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border rounded-lg py-2.5 text-sm font-medium min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]"
                >
                  {saving ? "Saving..." : editing ? "Save changes" : "Add section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleting(null)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-lg w-full sm:max-w-sm p-5 space-y-4 shadow-xl">
            <h2 className="font-semibold">Delete section?</h2>
            <p className="text-sm text-muted-foreground">
              <strong>{displaySection(deleting)}</strong> has <strong>{deleting._count.students}</strong> active students. Deleting it will unassign those students.
            </p>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 border rounded-lg py-2.5 text-sm font-medium min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="flex-1 bg-destructive text-destructive-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]"
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  disabled,
  saving,
  onChange,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  saving?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        disabled={disabled || saving}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 min-h-[44px]"
      >
        {children}
      </select>
      {saving && <span className="text-[11px] text-muted-foreground">Saving...</span>}
    </label>
  );
}
