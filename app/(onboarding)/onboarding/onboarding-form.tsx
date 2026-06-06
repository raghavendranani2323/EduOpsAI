"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

const schema = z.object({
  name: z.string().min(2, "Institution name is required"),
  type: z.enum(["SCHOOL", "COACHING", "PRESCHOOL", "TUITION"]),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  board: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const INSTITUTION_TYPES = [
  { value: "SCHOOL",   label: "School (CBSE / ICSE / State Board)" },
  { value: "COACHING", label: "Coaching / Test Prep Centre" },
  { value: "PRESCHOOL",label: "Preschool / Playschool" },
  { value: "TUITION",  label: "Tuition / Home Tutoring Centre" },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh",
];

export function OnboardingForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "SCHOOL" },
  });

  const type = watch("type");

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Institution type</label>
        <div className="grid grid-cols-1 gap-2">
          {INSTITUTION_TYPES.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors"
            >
              <input type="radio" value={value} {...register("type")} className="accent-primary" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          {type === "SCHOOL" ? "School name" : type === "PRESCHOOL" ? "Preschool name" : "Centre name"}
        </label>
        <input
          id="name"
          type="text"
          className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="e.g. Sri Vidya Mandir School"
          {...register("name")}
        />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="city" className="text-sm font-medium">City</label>
          <input
            id="city"
            type="text"
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Chennai"
            {...register("city")}
          />
          {errors.city && <p className="text-destructive text-xs">{errors.city.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="state" className="text-sm font-medium">State</label>
          <select
            id="state"
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
            {...register("state")}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.state && <p className="text-destructive text-xs">{errors.state.message}</p>}
        </div>
      </div>

      {type === "SCHOOL" && (
        <div className="space-y-1">
          <label htmlFor="board" className="text-sm font-medium">Board <span className="text-muted-foreground">(optional)</span></label>
          <select
            id="board"
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
            {...register("board")}
          >
            <option value="">Select board</option>
            <option>CBSE</option>
            <option>ICSE</option>
            <option>State Board</option>
            <option>IB</option>
            <option>IGCSE</option>
            <option>Other</option>
          </select>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
      >
        {loading ? "Setting up…" : "Create institution →"}
      </button>
    </form>
  );
}
