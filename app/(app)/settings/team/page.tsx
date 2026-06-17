import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { TeamPageClient } from "./team-client";
import { Prisma } from "@prisma/client";

type MemberWithUser = Prisma.MembershipGetPayload<{
  include: { user: { select: { id: true; fullName: true } } };
}>;

export default async function TeamPage() {
  const { user, institution, membership } = await requireInstitution();
  const canInvite = ["OWNER", "ADMIN"].includes(membership.role);

  const [members, invitations] = await withRls(user.id, (tx) =>
    Promise.all([
      tx.membership.findMany({
        where: { institutionId: institution.id, revokedAt: null },
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" },
      }),
      canInvite
        ? tx.invitation.findMany({
            where: { institutionId: institution.id, acceptedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            select: { id: true, email: true, role: true, expiresAt: true },
          })
        : Promise.resolve([]),
    ])
  );

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
      invitations={invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
      }))}
    />
  );
}
