import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";

const schema = z.object({
  name:             z.string().min(1).max(120).optional(),
  city:             z.string().min(1).max(80).optional(),
  state:            z.string().min(1).max(80).optional(),
  board:            z.string().max(80).optional().or(z.literal("")),
  affiliationNo:    z.string().max(40).optional().or(z.literal("")),
  phone:            z.string().max(20).optional().or(z.literal("")),
  addressLine1:     z.string().max(160).optional().or(z.literal("")),
  addressLine2:     z.string().max(160).optional().or(z.literal("")),
  pincode:          z.string().max(10).optional().or(z.literal("")),
  principalName:    z.string().max(120).optional().or(z.literal("")),
  gstNumber:        z.string().max(20).optional().or(z.literal("")),
  logoUrl:          z.string().max(500).optional().or(z.literal("")),
  receiptPrefix:    z.string().regex(/^[A-Z0-9-]{0,8}$/i, "Letters/digits/dashes only, max 8").optional().or(z.literal("")),
  siblingDiscounts: z.array(z.object({
    nth:     z.number().int().min(2).max(10),
    percent: z.number().int().min(0).max(100),
  })).max(5).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { user, institution, membership } = await requireInstitution();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "Insufficient permissions" }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const b = parsed.data;
    const data: Record<string, unknown> = {};
    if (b.name             !== undefined) data.name             = b.name.trim();
    if (b.city             !== undefined) data.city             = b.city.trim();
    if (b.state            !== undefined) data.state            = b.state.trim();
    if (b.board            !== undefined) data.board            = b.board.trim() || null;
    if (b.affiliationNo    !== undefined) data.affiliationNo    = b.affiliationNo.trim() || null;
    if (b.phone            !== undefined) data.phone            = b.phone.trim() || null;
    if (b.addressLine1     !== undefined) data.addressLine1     = b.addressLine1.trim() || null;
    if (b.addressLine2     !== undefined) data.addressLine2     = b.addressLine2.trim() || null;
    if (b.pincode          !== undefined) data.pincode          = b.pincode.trim() || null;
    if (b.principalName    !== undefined) data.principalName    = b.principalName.trim() || null;
    if (b.gstNumber        !== undefined) data.gstNumber        = b.gstNumber.trim().toUpperCase() || null;
    if (b.logoUrl          !== undefined) data.logoUrl          = b.logoUrl.trim() || null;
    if (b.receiptPrefix    !== undefined) data.receiptPrefix    = b.receiptPrefix.trim().toUpperCase() || "INV";
    if (b.siblingDiscounts !== undefined) data.siblingDiscounts = b.siblingDiscounts;

    await withRls(user.id, (tx) =>
      tx.institution.update({ where: { id: institution.id }, data })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
