import { requireInstitution } from "@/lib/tenant/current";
import { prisma } from "@/lib/prisma/client";
import { TeamPageClient } from "./team-client";
import { Prisma } from "@prisma/client";
import type { Invitation } from "@prisma/client";

type MemberWithUser = Prisma.MembershipGetPayload<{
  include: { user: { select: { id: true; fullName: true } } };
}>;

export default async function TeamPage() {
  const { institution, membership } = await requireInstitution();

  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { institutionId: institution.id, revokedAt: null },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { institutionId: institution.id, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const canInvite = ["OWNER", "ADMIN"].includes(membership.role);

  return (
    <TeamPageClient
      institutionName={institution.name}
      currentUserId={membership.userId}
      canInvite={canInvite}
      members={members.map((m: MemberWithUser) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user.fullName,
        role: m.role,
      }))}
      invitations={invitations.map((i: Invitation) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        token: i.token,
      }))}
    />
  );
}
