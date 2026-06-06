import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import type { InstitutionType } from "@prisma/client";

const schema = z.object({
  name: z.string().min(2),
  type: z.enum(["SCHOOL", "COACHING", "PRESCHOOL", "TUITION"]),
  city: z.string().min(2),
  state: z.string().min(2),
  board: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { name, type, city, state, board } = parsed.data;

  // Ensure profile exists
  await prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      fullName: user.user_metadata?.full_name ?? user.email ?? "User",
      phone: user.user_metadata?.phone,
    },
    update: {},
  });

  const institution = await prisma.institution.create({
    data: {
      name,
      type: type as InstitutionType,
      city,
      state,
      board: board || null,
      memberships: {
        create: {
          userId: user.id,
          role: "OWNER",
          acceptedAt: new Date(),
        },
      },
    },
  });

  // Set institution cookie (1 year)
  const response = NextResponse.json({ ok: true, institutionId: institution.id });
  response.cookies.set("eduops_institution_id", institution.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
