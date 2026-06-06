"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Building2 } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name:          z.string().min(1, "Name required"),
  city:          z.string().min(1, "City required"),
  state:         z.string().min(1, "State required"),
  board:         z.string().optional(),
  affiliationNo: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = {
  SCHOOL: "School", COACHING: "Coaching centre", PRESCHOOL: "Preschool", TUITION: "Tuition centre",
};

interface Props {
  institution: { id: string; name: string; type: string; city: string; state: string; board: string; affiliationNo: string };
  canEdit: boolean;
}

export function InstitutionSettingsClient({ institution, canEdit }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      name:          institution.name,
      city:          institution.city,
      state:         institution.state,
      board:         institution.board,
      affiliationNo: institution.affiliationNo,
    },
  });

  async function onSubmit(data: FormData) {
    setSaving(true); setError(null); setSaved(false);
    const res    = await fetch("/api/institution", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await res.json();
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Institution profile</h1>
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Institution type</p>
        </div>
        <p className="font-medium">{TYPE_LABELS[institution.type] ?? institution.type}</p>
        <p className="text-xs text-muted-foreground mt-1">Type cannot be changed after onboarding.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Institution name *</label>
          <input {...register("name")} disabled={!canEdit} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60" />
          {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">City *</label>
            <input {...register("city")} disabled={!canEdit} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60" />
            {errors.city && <p className="text-destructive text-xs mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">State *</label>
            <input {...register("state")} disabled={!canEdit} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60" />
            {errors.state && <p className="text-destructive text-xs mt-1">{errors.state.message}</p>}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Board (optional)</label>
          <input {...register("board")} placeholder="e.g. CBSE, ICSE, State Board" disabled={!canEdit} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Affiliation no. (optional)</label>
          <input {...register("affiliationNo")} placeholder="e.g. CBSE affiliation number" disabled={!canEdit} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60" />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved  && <p className="text-green-600 text-sm">Saved successfully.</p>}

        {canEdit && (
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-60 min-h-[48px]"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}

        {!canEdit && (
          <p className="text-sm text-muted-foreground text-center">Only admins and owners can edit institution details.</p>
        )}
      </form>
    </div>
  );
}
