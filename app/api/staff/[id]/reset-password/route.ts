import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { randomPassword } from "@/lib/staff/helpers";

// Owner/admin issues fresh login credentials for a TEACHER in their institution.
// Teachers belonging to any other institution are never touched (cross-tenant safety).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Only owners and admins can reset passwords" }, { status: 403 });
  }

  const { id: targetId } = await params;

  // Rate limit: max 10 resets per admin per hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prismaAdmin.auditLog.count({
    where: { actorUserId: user.id, action: "staff.password_reset", createdAt: { gte: hourAgo } },
  }).catch(() => 0);
  if (recent >= 10) {
    return NextResponse.json({ ok: false, error: "Rate limit reached: max 10 password resets per hour." }, { status: 429 });
  }

  const memberships = await prismaAdmin.membership.findMany({
    where: { userId: targetId, revokedAt: null },
    select: { institutionId: true, role: true },
  });
  const here = memberships.find(m => m.institutionId === institution.id);
  if (!here) {
    return NextResponse.json({ ok: false, error: "Staff member not found in this institution" }, { status: 404 });
  }
  if (here.role !== "TEACHER") {
    return NextResponse.json({ ok: false, error: "Only teacher passwords can be reset here. Admins use email password recovery." }, { status: 403 });
  }
  if (memberships.some(m => m.institutionId !== institution.id)) {
    return NextResponse.json({ ok: false, error: "This teacher also belongs to another institution, so their password can't be reset from here." }, { status: 409 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  // Real auth identifiers (source of truth, not the profile row)
  const rows = await prismaAdmin.$queryRawUnsafe<Array<{ email: string | null; phone: string | null }>>(
    `SELECT email, phone::text FROM auth.users WHERE id = $1::uuid LIMIT 1`,
    targetId,
  );
  const authUser = rows[0];
  if (!authUser) {
    return NextResponse.json({ ok: false, error: "Login account not found for this teacher" }, { status: 404 });
  }

  const password = randomPassword();
  const admin = createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const updated = await admin.auth.admin.updateUserById(targetId, { password });
  if (updated.error) {
    return NextResponse.json({ ok: false, error: updated.error.message }, { status: 500 });
  }

  const profile = await prismaAdmin.profile.findUnique({ where: { id: targetId }, select: { fullName: true } });
  const fullName = profile?.fullName ?? "Teacher";
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const mode: "email" | "phone" = authUser.email ? "email" : "phone";
  const identifier = mode === "email" ? authUser.email! : `+${authUser.phone}`;
  const loginUrl = mode === "email" ? `${origin}/login` : `${origin}/teacher-login`;

  await prismaAdmin.auditLog.create({
    data: {
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.password_reset",
      targetId,
      meta: { mode },
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    credentials: {
      mode,
      identifier,
      password,
      loginUrl,
      whatsappShare: `Hi ${fullName.split(" ")[0]}, your EduOps login:\n${mode === "email" ? "Email" : "Phone"}: ${identifier}\nPassword: ${password}\nLogin: ${loginUrl}`,
    },
  });
}
