import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { whatsappLink } from "@/lib/format/phone";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, institution } = await requireInstitution();
    const { id } = await ctx.params;

    const result = await withRls(user.id, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id, institutionId: institution.id },
        include: {
          guardians: {
            where: { isPrimary: true },
            take: 1,
            include: { guardian: { select: { fullName: true, phone: true } } },
          },
        },
      });
      if (!student) return null;

      let token = student.portalToken;
      if (!token) {
        token = randomBytes(18).toString("base64url");
        await tx.student.update({ where: { id }, data: { portalToken: token } });
      }
      return { student, token };
    });

    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const origin = new URL(_req.url).origin;
    const url = `${origin}/p/${result.token}`;

    const g = result.student.guardians[0]?.guardian;
    const greeting = g?.fullName ? `Dear ${g.fullName}` : "Dear Parent";
    const body = `${greeting}, you can view ${result.student.fullName}'s attendance, fees and homework anytime here: ${url} — ${institution.name}`;
    const shareLink = g?.phone ? whatsappLink(g.phone, body) : null;

    return NextResponse.json({
      ok: true,
      url,
      shareLink,
      guardianPhone: g?.phone ?? null,
      guardianName:  g?.fullName ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
