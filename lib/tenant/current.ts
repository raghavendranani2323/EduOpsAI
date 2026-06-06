import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma/client";
import { requireUser } from "@/lib/auth/session";

const INSTITUTION_COOKIE = "eduops_institution_id";

export async function getCurrentInstitutionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(INSTITUTION_COOKIE)?.value ?? null;
}

export async function requireInstitution() {
  const user = await requireUser();
  const institutionId = await getCurrentInstitutionId();

  if (institutionId) {
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, institutionId, revokedAt: null },
      include: { institution: true },
    });
    if (membership) return { user, membership, institution: membership.institution };
  }

  // Fall back to first active membership
  const first = await prisma.membership.findFirst({
    where: { userId: user.id, revokedAt: null },
    include: { institution: true },
    orderBy: { createdAt: "asc" },
  });

  if (!first) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding");
  }

  return { user, membership: first!, institution: first!.institution };
}
