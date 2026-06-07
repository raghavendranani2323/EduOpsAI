"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, MapPin, Phone, Award, FileText, Receipt, Users2, Plus, Trash2, Save, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const schema = z.object({
  name:          z.string().min(1, "Required"),
  city:          z.string().min(1, "Required"),
  state:         z.string().min(1, "Required"),
  board:         z.string().optional(),
  affiliationNo: z.string().optional(),
  phone:         z.string().optional(),
  addressLine1:  z.string().optional(),
  addressLine2:  z.string().optional(),
  pincode:       z.string().optional(),
  principalName: z.string().optional(),
  gstNumber:     z.string().optional(),
  logoUrl:       z.string().optional(),
  receiptPrefix: z.string().regex(/^[A-Z0-9-]{0,8}$/i, "Up to 8 letters/digits/dashes").optional(),
  siblingDiscounts: z.array(z.object({
    nth:     z.number().int().min(2).max(10),
    percent: z.number().int().min(0).max(100),
  })).max(5),
});
type FormData = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = {
  SCHOOL: "School", COACHING: "Coaching centre", PRESCHOOL: "Preschool", TUITION: "Tuition centre",
};

interface Props {
  institution: {
    id: string; name: string; type: string;
    city: string; state: string;
    board: string; affiliationNo: string;
    phone: string; addressLine1: string; addressLine2: string; pincode: string;
    principalName: string; gstNumber: string; logoUrl: string;
    receiptPrefix: string; receiptCounter: number;
    siblingDiscounts: Array<{ nth: number; percent: number }>;
  };
  canEdit: boolean;
}

export function InstitutionSettingsClient({ institution, canEdit }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, control, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      ...institution,
      siblingDiscounts: institution.siblingDiscounts.length > 0
        ? institution.siblingDiscounts
        : [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "siblingDiscounts" });

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/institution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-6 space-y-4 max-w-2xl pb-32">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Institution profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          These details appear on every fee receipt, notice and parent message.
        </p>
      </div>

      {/* Identity */}
      <Section icon={Building2} title="Identity">
        <Field label="Name *" error={errors.name?.message}>
          <Input {...register("name")} disabled={!canEdit} />
        </Field>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          Type: <span className="font-semibold text-foreground">{TYPE_LABELS[institution.type] ?? institution.type}</span>
          {" "}— set once at signup, contact support to change.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Board">
            <Input {...register("board")} placeholder="CBSE / ICSE / State" disabled={!canEdit} />
          </Field>
          <Field label="Affiliation no.">
            <Input {...register("affiliationNo")} disabled={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* Contact + address */}
      <Section icon={MapPin} title="Address & contact">
        <Field label="Phone (school office)">
          <Input
            type="tel" inputMode="tel"
            placeholder="+91 98765 43210"
            {...register("phone")}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Address line 1">
          <Input placeholder="123 School Road" {...register("addressLine1")} disabled={!canEdit} />
        </Field>
        <Field label="Address line 2">
          <Input placeholder="Near Bus Stand" {...register("addressLine2")} disabled={!canEdit} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City *" error={errors.city?.message}>
            <Input {...register("city")} disabled={!canEdit} />
          </Field>
          <Field label="State *" error={errors.state?.message}>
            <Input {...register("state")} disabled={!canEdit} />
          </Field>
        </div>
        <Field label="PIN code">
          <Input inputMode="numeric" maxLength={6} {...register("pincode")} disabled={!canEdit} />
        </Field>
      </Section>

      {/* Leadership */}
      <Section icon={IdCard} title="Leadership">
        <Field label="Principal / Head name">
          <Input placeholder="Mr. Ramesh Kumar" {...register("principalName")} disabled={!canEdit} />
        </Field>
      </Section>

      {/* Receipt header */}
      <Section icon={Receipt} title="Receipts">
        <Field label="Receipt prefix" hint="E.g. 'INV' will print as INV-001, INV-002…" error={errors.receiptPrefix?.message}>
          <Input {...register("receiptPrefix")} placeholder="INV" disabled={!canEdit} />
        </Field>
        <div className="text-xs text-muted-foreground">
          Last receipt number issued: <span className="font-mono font-semibold text-foreground">{institution.receiptCounter}</span>
        </div>
        <Field label="GST number (optional)">
          <Input {...register("gstNumber")} placeholder="22AAAAA0000A1Z5" disabled={!canEdit} className="uppercase tracking-wider" />
        </Field>
        <Field label="Logo URL (optional)" hint="Square image, hosted on your storage or CDN">
          <Input type="url" placeholder="https://…" {...register("logoUrl")} disabled={!canEdit} />
        </Field>
      </Section>

      {/* Sibling discount tiers */}
      <Section icon={Users2} title="Sibling discount">
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          Applied automatically when generating invoices. Identify siblings by shared guardian phone.
        </p>
        {fields.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
            No discount tiers yet.
          </div>
        )}
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Child #</p>
                  <Input
                    type="number" min={2} max={10}
                    {...register(`siblingDiscounts.${i}.nth` as const, { valueAsNumber: true })}
                    disabled={!canEdit}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Discount %</p>
                  <Input
                    type="number" min={0} max={100}
                    {...register(`siblingDiscounts.${i}.percent` as const, { valueAsNumber: true })}
                    disabled={!canEdit}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {canEdit && (
                <Button type="button" variant="ghost" size="iconSm" onClick={() => remove(i)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
        {canEdit && fields.length < 5 && (
          <Button type="button" variant="outline" size="sm" onClick={() => append({ nth: fields.length + 2, percent: 5 })} className="mt-2">
            <Plus /> Add tier
          </Button>
        )}
      </Section>

      {canEdit && (
        <div className="fixed bottom-0 inset-x-0 md:left-60 bg-card/95 backdrop-blur-md border-t border-border p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] z-20">
          <div className="max-w-2xl mx-auto">
            <Button type="submit" disabled={saving || !isDirty} size="lg" className="w-full">
              <Save /> {saving ? "Saving…" : isDirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </div>
      )}
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

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
