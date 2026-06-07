"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Archive, X } from "lucide-react";
import type { Terminology } from "@/lib/i18n/terminology";

const schema = z.object({
  fullName:    z.string().min(1, "Full name is required"),
  admissionNo: z.string().optional(),
  gender:      z.enum(["MALE", "FEMALE", "OTHER", ""]).optional(),
  dob:         z.string().optional(),
  classId:     z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  student: {
    id: string;
    fullName: string;
    admissionNo: string | null;
    gender: string | null;
    dob: string | null;
    classId: string | null;
    status: string;
    tagIds: string[];
  };
  classes: { id: string; name: string; section: string | null }[];
  tags:    { id: string; label: string; color: string }[];
  terminology: Terminology;
}

export function StudentDetailClient({ student, classes, tags, terminology: t }: Props) {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(student.tagIds);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName:    student.fullName,
      admissionNo: student.admissionNo ?? "",
      gender:      (student.gender as FormData["gender"]) ?? "",
      dob:         student.dob ?? "",
      classId:     student.classId ?? "",
    },
  });

  function toggleTag(id: string) {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, gender: data.gender || null, classId: data.classId || null, tagIds: selectedTags }),
    });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    setOpen(false);
    router.refresh();
  }

  async function archive() {
    if (!confirm(`Archive ${student.fullName}? They will be hidden from active lists.`)) return;
    setSaving(true);
    await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: student.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2 pb-4">
        <button
          onClick={() => setOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 border rounded-xl py-2.5 text-sm font-medium min-h-[44px] hover:bg-muted transition-colors"
        >
          <Pencil className="h-4 w-4" /> Edit {t.student}
        </button>
        <button
          onClick={archive}
          disabled={saving}
          className="flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] hover:bg-muted transition-colors disabled:opacity-60"
        >
          <Archive className="h-4 w-4" />
          {student.status === "ACTIVE" ? "Archive" : "Restore"}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Edit {t.student}</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Full name *</label>
                <input {...register("fullName")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {errors.fullName && <p className="text-destructive text-xs mt-1">{errors.fullName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Admission No.</label>
                  <input {...register("admissionNo")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date of birth</label>
                  <input type="date" {...register("dob")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Gender</label>
                  <select {...register("gender")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">—</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t.class}</label>
                  <select {...register("classId")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">—</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? `-${c.section}` : ""}</option>)}
                  </select>
                </div>
              </div>

              {tags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className="rounded-full px-3 py-1 text-xs font-medium border transition-all"
                        style={
                          selectedTags.includes(tag.id)
                            ? { backgroundColor: tag.color, color: "#fff", borderColor: tag.color }
                            : { color: tag.color, borderColor: tag.color + "66" }
                        }
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-destructive text-sm">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
