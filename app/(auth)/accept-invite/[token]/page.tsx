import { AcceptInviteClient } from "./accept-invite-client";
import { prisma } from "@/lib/prisma/client";
import { getUser } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { institution: { select: { name: true } } },
  });

  const user = await getUser();

  if (!invitation) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Invitation not found</h1>
        <p className="text-muted-foreground text-sm">This invitation link is invalid.</p>
        <a href="/login" className="inline-block text-primary font-medium text-sm">Go to login →</a>
      </div>
    );
  }

  const expired = invitation.expiresAt < new Date();
  const accepted = !!invitation.acceptedAt;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{invitation.institution.name}</h1>
        <p className="text-muted-foreground text-sm">
          You&apos;ve been invited as <span className="font-medium text-foreground">{invitation.role.toLowerCase()}</span>
        </p>
      </div>

      <AcceptInviteClient
        token={token}
        email={invitation.email}
        expired={expired}
        accepted={accepted}
        userEmail={user?.email ?? null}
      />
    </div>
  );
}
