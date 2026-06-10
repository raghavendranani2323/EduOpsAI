import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireInstitution } from "@/lib/tenant/current";
import { prismaAdmin } from "@/lib/prisma/admin";
import { normalizeIndianPhone } from "@/lib/staff/helpers";

const schema = z.object({
  fullName:      z.string().min(2).max(120).optional(),
  phone:         z.string().min(10).max(20).optional(),
  email:         z.string().email().optional().or(z.literal("")),
  designation:   z.string().max(60).optional().or(z.literal("")),
  qualification: z.string().max(120).optional().or(z.literal("")),
});

// Owner/admin updates a staff member's details within their institution.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, institution, membership } = await requireInstitution();
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Only owners and admins can edit staff" }, { status: 403 });
  }

  const { id: targetId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const target = await prismaAdmin.membership.findFirst({
    where: { userId: targetId, institutionId: institution.id, revokedAt: null },
  });
  if (!target) {
    return NextResponse.json({ ok: false, error: "Staff member not found in this institution" }, { status: 404 });
  }
  if (target.role === "OWNER" && targetId !== user.id) {
    return NextResponse.json({ ok: false, error: "The owner's details can only be edited by themselves" }, { status: 403 });
  }

  const { fullName, phone, email: rawEmail, designation, qualification } = parsed.data;

  let normalizedPhone: string | undefined;
  if (phone !== undefined) {
    const n = normalizeIndianPhone(phone);
    if (!n) return NextResponse.json({ ok: false, error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
    normalizedPhone = n;
  }
  const email = rawEmail === undefined ? undefined : rawEmail.trim().toLowerCase() || null;

  // Keep auth identifiers in sync so credentials shown to the owner stay correct.
  if (normalizedPhone !== undefined || email) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
    const admin = createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const updated = await admin.auth.admin.updateUserById(targetId, {
      ...(normalizedPhone !== undefined ? { phone: normalizedPhone.replace(/^\+/, ""), phone_confirm: true } : {}),
      ...(email ? { email, email_confirm: true } : {}),
      ...(fullName ? { user_metadata: { fullName } } : {}),
    });
    if (updated.error) {
      return NextResponse.json({ ok: false, error: updated.error.message }, { status: 500 });
    }
  }

  const profile = await prismaAdmin.profile.update({
    where: { id: targetId },
    data: {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(designation !== undefined ? { designation: designation.trim() || null } : {}),
      ...(qualification !== undefined ? { qualification: qualification.trim() || null } : {}),
    },
    select: { id: true, fullName: true, phone: true, email: true, designation: true, qualification: true },
  });

  await prismaAdmin.auditLog.create({
    data: {
      actorUserId: user.id,
      institutionId: institution.id,
      action: "staff.update",
      targetId,
      meta: { fields: Object.keys(parsed.data) },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, profile });
}
