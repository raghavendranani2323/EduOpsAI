import { cookies } from "next/headers";
import { prismaAdmin } from "@/lib/prisma/admin";
import { requireUser } from "@/lib/auth/session";

const INSTITUTION_COOKIE = "eduops_institution_id";

export async function getCurrentInstitutionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(INSTITUTION_COOKIE)?.value ?? null;
}

export async function requireInstitution() {
  const user = await requireUser();
  const institutionId = await getCurrentInstitutionId();

  // Membership resolution always scoped to user.id from Supabase session — admin
  // client is only used because the request hasn't established RLS claims yet.
  if (institutionId) {
    const membership = await prismaAdmin.membership.findFirst({
      where: { userId: user.id, institutionId, revokedAt: null },
      include: { institution: true },
    });
    if (membership) return { user, membership, institution: membership.institution };
  }

  const first = await prismaAdmin.membership.findFirst({
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
