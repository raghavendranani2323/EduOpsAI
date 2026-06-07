"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import type { InstitutionType } from "@prisma/client";
import { getTerminology } from "@/lib/i18n/terminology";

const schema = z.object({
  fullName:    z.string().min(1, "Full name is required"),
  admissionNo: z.string().optional(),
  gender:      z.enum(["MALE", "FEMALE", "OTHER", ""]).optional(),
  dob:         z.string().optional(),
  classId:     z.string().optional(),
  // Guardian
  guardianName:     z.string().optional(),
  guardianPhone:    z.string().optional(),
  guardianRelation: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  classes: { id: string; name: string; section: string | null }[];
  tags:    { id: string; label: string; color: string }[];
  institutionType: InstitutionType;
}

export function NewStudentForm({ classes, tags, institutionType }: Props) {
  const t      = getTerminology(institutionType);
  const router = useRouter();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function toggleTag(id: string) {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName:    data.fullName,
        admissionNo: data.admissionNo || undefined,
        gender:      data.gender || undefined,
        dob:         data.dob || undefined,
        classId:     data.classId || undefined,
        guardian:    data.guardianName ? {
          fullName: data.guardianName,
          phone:    data.guardianPhone ?? "",
          relation: data.guardianRelation ?? "parent",
        } : undefined,
        tagIds: selectedTags,
      }),
    });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    router.push(`/students/${result.student.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">New {t.student}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Basic info */}
        <section className="space-y-3 border rounded-xl p-4">
          <h2 className="font-semibold text-sm">Basic information</h2>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Full name *</label>
            <input {...register("fullName")} placeholder="Aarav Sharma" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            {errors.fullName && <p className="text-destructive text-xs mt-1">{errors.fullName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Admission No.</label>
              <input {...register("admissionNo")} placeholder="2025-001" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
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
                <option value="">— select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t.class}</label>
              <select {...register("classId")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">— select —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? `-${c.section}` : ""}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Guardian */}
        <section className="space-y-3 border rounded-xl p-4">
          <h2 className="font-semibold text-sm">{t.guardian}</h2>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Full name</label>
            <input {...register("guardianName")} placeholder="Rajesh Sharma" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input {...register("guardianPhone")} placeholder="+91 98765 43210" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Relation</label>
              <select {...register("guardianRelation")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="parent">Parent</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
              </select>
            </div>
          </div>
        </section>

        {/* Tags */}
        {tags.length > 0 && (
          <section className="space-y-2 border rounded-xl p-4">
            <h2 className="font-semibold text-sm">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="rounded-full px-3 py-1 text-xs font-medium border transition-all min-h-[36px]"
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
          </section>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border rounded-xl py-3 text-sm font-medium min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-medium disabled:opacity-60 min-h-[44px]"
          >
            {saving ? "Saving…" : `Add ${t.student}`}
          </button>
        </div>
      </form>
    </div>
  );
}
