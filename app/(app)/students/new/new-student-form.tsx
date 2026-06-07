"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronLeft, User, Calendar, BookOpen, Tag as TagIcon, Phone, UserCircle2, Save } from "lucide-react";
import type { InstitutionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useI18n } from "@/components/i18n/provider";

const schema = z.object({
  fullName:         z.string().min(1, "Full name is required").max(120),
  admissionNo:      z.string().max(30).optional(),
  gender:           z.enum(["MALE", "FEMALE", "OTHER", ""]).optional(),
  dob:              z.string().optional(),
  classId:          z.string().optional(),
  guardianName:     z.string().optional(),
  guardianPhone:    z.string().max(15).optional(),
  guardianRelation: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.guardianName?.trim() && !data.guardianPhone?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["guardianPhone"],
      message: "Guardian phone is required when guardian name is entered",
    });
  }
  if (data.guardianPhone?.trim() && !data.guardianName?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["guardianName"],
      message: "Guardian name is required when phone is entered",
    });
  }
});
type FormData = z.infer<typeof schema>;

interface Props {
  classes: { id: string; name: string; section: string | null }[];
  tags:    { id: string; label: string; color: string }[];
  institutionType: InstitutionType;
}

const RELATIONS = [
  { value: "Father", labelKey: "father" },
  { value: "Mother", labelKey: "mother" },
  { value: "Guardian", labelKey: "guardianRelation" },
  { value: "Grandfather", labelKey: "grandfather" },
  { value: "Grandmother", labelKey: "grandmother" },
  { value: "Other", labelKey: "otherRelation" },
] as const;

export function NewStudentForm({ classes, tags }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { guardianRelation: "Father" },
  });
  const fullNameError = errors.fullName ? t("studentForm", "fullNameRequired") : undefined;
  const guardianNameError = errors.guardianName ? t("studentForm", "guardianNameRequired") : undefined;
  const guardianPhoneError = errors.guardianPhone ? t("studentForm", "guardianPhoneRequired") : undefined;

  function toggleTag(id: string) {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
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
            relation: data.guardianRelation || undefined,
          } : undefined,
          tagIds: selectedTags,
        }),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error ?? t("studentForm", "failed")); return; }
      toast.success(t("studentForm", "added", { name: data.fullName }));
      router.push(`/students/${result.student.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-6 max-w-2xl space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Link href="/students" className="tap h-10 w-10 -ml-1 rounded-xl flex items-center justify-center hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("studentForm", "title", { student: t("studentForm", "student") })}</h1>
          <p className="text-sm text-muted-foreground">{t("studentForm", "intro")}</p>
        </div>
      </div>

      {/* Basics */}
      <Section icon={User} title={t("studentForm", "basics")}>
        <Field label={t("studentForm", "fullName")} error={fullNameError}>
          <Input autoFocus placeholder="Aarav Sharma" {...register("fullName")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("studentForm", "admissionNo")}>
            <Input placeholder="ADM-001" {...register("admissionNo")} />
          </Field>
          <Field label={t("studentForm", "gender")}>
            <Select {...register("gender")}>
              <option value="">—</option>
              <option value="MALE">{t("studentForm", "male")}</option>
              <option value="FEMALE">{t("studentForm", "female")}</option>
              <option value="OTHER">{t("studentForm", "other")}</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("studentForm", "dob")} icon={Calendar}>
            <Input type="date" {...register("dob")} />
          </Field>
          <Field label={t("studentForm", "class")} icon={BookOpen}>
            <Select {...register("classId")}>
              <option value="">—</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.section ? `${c.name} – ${c.section}` : c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      {/* Guardian */}
      <Section icon={UserCircle2} title={t("studentForm", "guardian")}>
        <Field label={t("studentForm", "guardianName")} error={guardianNameError}>
          <Input placeholder="Rajesh Sharma" {...register("guardianName")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("studentForm", "phone")} icon={Phone} error={guardianPhoneError}>
            <Input type="tel" inputMode="tel" placeholder="9876543210" {...register("guardianPhone")} />
          </Field>
          <Field label={t("studentForm", "relation")}>
            <Select {...register("guardianRelation")}>
              {RELATIONS.map(r => <option key={r.value} value={r.value}>{t("studentForm", r.labelKey)}</option>)}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("studentForm", "guardianHelp")}
        </p>
      </Section>

      {/* Tags */}
      {tags.length > 0 && (
        <Section icon={TagIcon} title={t("studentForm", "tags")}>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => {
              const on = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                    on ? "border-primary" : "border-border bg-card hover:bg-muted"
                  }`}
                  style={on ? { backgroundColor: tag.color + "22", color: tag.color, borderColor: tag.color } : undefined}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Sticky save */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 inset-x-0 md:left-60 bg-card/95 backdrop-blur-md border-t border-border p-3 z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
          <Link href="/students" className="block">
            <Button type="button" variant="outline" size="lg" className="w-full" disabled={saving}>
              {t("studentForm", "cancel")}
            </Button>
          </Link>
          <Button type="submit" size="lg" disabled={saving}>
            <Save /> {saving ? t("studentForm", "saving") : t("studentForm", "save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 space-y-3.5">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-semibold text-sm tracking-tight">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function Field({ label, icon: Icon, error, children }: { label: string; icon?: React.ElementType; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
