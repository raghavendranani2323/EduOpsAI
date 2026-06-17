import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { writeAuditEvent } from "@/lib/audit/server";

// Owner/admin triggers secure recovery for a TEACHER in their institution.
// The API never returns reusable passwords or recovery links to the admin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.password_recovery",
      outcome: "denied",
      meta: { role: membership.role },
    });
    return NextResponse.json({ ok: false, error: "Only owners and admins can start password recovery" }, { status: 403 });
  }

  const { id: targetId } = await params;

  // Rate limit: max 10 resets per admin per hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prismaAdmin.auditLog.count({
    where: { actorUserId: user.id, action: "staff.password_recovery", createdAt: { gte: hourAgo } },
  }).catch(() => 0);
  if (recent >= 10) {
    return NextResponse.json({ ok: false, error: "Rate limit reached: max 10 password recovery attempts per hour." }, { status: 429 });
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
    return NextResponse.json({ ok: false, error: "Only teacher password recovery can be started here. Admins use the login page recovery flow." }, { status: 403 });
  }
  if (memberships.some(m => m.institutionId !== institution.id)) {
    return NextResponse.json({ ok: false, error: "Password recovery cannot be started for this staff account here." }, { status: 409 });
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

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  if (!authUser.email) {
    await writeAuditEvent({
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.password_recovery",
      targetId,
      outcome: "denied",
      meta: { reason: "missing_email" },
    });
    return NextResponse.json({
      ok: false,
      error: "This teacher does not have an email login. Add an email and invite them to set up secure access.",
    }, { status: 400 });
  }

  const admin = createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const recovery = await admin.auth.resetPasswordForEmail(authUser.email, {
    redirectTo: `${origin}/login`,
  });
  if (recovery.error) {
    console.error("[staff/password-recovery] provider failure", recovery.error.message);
    return NextResponse.json({ ok: false, error: "Could not start password recovery" }, { status: 500 });
  }

  await writeAuditEvent({
    actorUserId: user.id,
    institutionId: institution.id,
    action: "staff.password_recovery",
    targetId,
    outcome: "success",
    meta: { mode: "email" },
  });

  return NextResponse.json({
    ok: true,
    message: "Password recovery email sent to the teacher.",
  });
}
