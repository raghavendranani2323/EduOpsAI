import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { AdmissionsClient } from "./admissions-client";
import { todayIST } from "@/lib/format/date";

export default async function AdmissionsPage() {
  const { user, institution } = await requireInstitution();
  const today = new Date(todayIST());

  const { leads, classes, dueTodayCount } = await withRls(user.id, async (tx) => {
    const [leads, classes] = await Promise.all([
      tx.lead.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ nextFollowupAt: "asc" }, { createdAt: "desc" }],
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const dueTodayCount = leads.filter(l =>
      l.nextFollowupAt &&
      l.stage !== "CONVERTED" &&
      l.stage !== "LOST" &&
      new Date(l.nextFollowupAt).toISOString().split("T")[0] <= today.toISOString().split("T")[0]
    ).length;

    return {
      leads: leads.map(l => ({
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
        convertedToStudentId: l.convertedToStudentId,
        createdAt:        l.createdAt.toISOString().split("T")[0],
      })),
      classes,
      dueTodayCount,
    };
  });

  return <AdmissionsClient leads={leads} classes={classes} dueTodayCount={dueTodayCount} />;
}
