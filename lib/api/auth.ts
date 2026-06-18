import "server-only";

import { ApiError } from "@/lib/api/errors";
import { getUser } from "@/lib/auth/session";
import { prismaAdmin } from "@/lib/prisma/admin";
import { getCurrentInstitutionId } from "@/lib/tenant/current";

export async function requireApiUser() {
  const user = await getUser();
  if (!user) {
    throw new ApiError(401, "AUTH_REQUIRED", "Please sign in to continue");
  }
  return user;
}

export async function requireApiInstitution() {
  const user = await requireApiUser();
  const selectedInstitutionId = await getCurrentInstitutionId();

  if (selectedInstitutionId) {
    const membership = await prismaAdmin.membership.findFirst({
      where: {
        userId: user.id,
        institutionId: selectedInstitutionId,
        revokedAt: null,
      },
      include: { institution: true },
    });
    if (membership) {
      return { user, membership, institution: membership.institution };
    }
  }

  const membership = await prismaAdmin.membership.findFirst({
    where: { userId: user.id, revokedAt: null },
    include: { institution: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    throw new ApiError(403, "INSTITUTION_REQUIRED", "Complete institution setup to continue");
  }

  return { user, membership, institution: membership.institution };
}
