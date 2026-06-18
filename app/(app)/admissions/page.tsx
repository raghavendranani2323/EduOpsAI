import { redirect } from "next/navigation";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { AdmissionsClient } from "./admissions-client";
import { todayIST } from "@/lib/format/date";

export default async function AdmissionsPage() {
  const { user, institution, membership } = await requireInstitution();
  if (membership.role === "TEACHER") redirect("/dashboard");
  const today = new Date(todayIST());

  const { leads, classes, owners, dueTodayCount } = await withRls(user.id, async (tx) => {
    const [leads, classes, owners] = await Promise.all([
      tx.lead.findMany({
        where: { institutionId: institution.id },
        include: { assignedTo: { select: { id: true, fullName: true } } },
        orderBy: [{ nextFollowupAt: "asc" }, { createdAt: "desc" }],
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      tx.membership.findMany({
        where: {
          institutionId: institution.id,
          revokedAt: null,
          role: { in: ["OWNER", "ADMIN"] },
        },
        select: { user: { select: { id: true, fullName: true } } },
        orderBy: { user: { fullName: "asc" } },
      }),
    ]);

    const dueTodayCount = leads.filter((l) =>
      l.nextFollowupAt &&
      l.stage !== "CONVERTED" &&
      l.stage !== "LOST" &&
      new Date(l.nextFollowupAt).toISOString().split("T")[0] <= today.toISOString().split("T")[0]
    ).length;

    return {
      leads: leads.map((l) => ({
        id:               l.id,
        studentName:      l.studentName,
        guardianName:     l.guardianName,
        phone:            l.phone,
        interestedClass:  l.interestedClass,
        source:           l.source as string,
        priority:         l.priority as string,
        stage:            l.stage as string,
        nextFollowupAt:   l.nextFollowupAt?.toISOString().split("T")[0] ?? null,
        lastNote:         l.lastNote,
        assignedToId:     l.assignedToId,
        assignedToName:   l.assignedTo?.fullName ?? null,
        lostReason:       l.lostReason,
        convertedToStudentId: l.convertedToStudentId,
        convertedAt:      l.convertedAt?.toISOString() ?? null,
        createdAt:        l.createdAt.toISOString().split("T")[0],
      })),
      classes,
      owners: owners.map((membership) => membership.user),
      dueTodayCount,
    };
  });

  return <AdmissionsClient leads={leads} classes={classes} owners={owners} dueTodayCount={dueTodayCount} />;
}
