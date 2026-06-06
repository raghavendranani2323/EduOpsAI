import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prismaAdmin } from "@/lib/prisma/admin";
import type { Role } from "@prisma/client";

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(institutionId: string, ...roles: Role[]) {
  const user = await requireUser();
  const membership = await prismaAdmin.membership.findFirst({
    where: {
      userId: user.id,
      institutionId,
      revokedAt: null,
      role: { in: roles },
    },
  });
  if (!membership) redirect("/dashboard");
  return { user, membership };
}

export async function getUserMemberships(userId: string) {
  return prismaAdmin.membership.findMany({
    where: { userId, revokedAt: null },
    include: { institution: true },
    orderBy: { createdAt: "asc" },
  });
}
