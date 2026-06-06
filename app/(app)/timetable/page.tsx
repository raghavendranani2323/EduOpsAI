import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { TimetableClient } from "./timetable-client";

export default async function TimetablePage() {
  const { user, institution } = await requireInstitution();

  const { slots, classes, subjects } = await withRls(user.id, async (tx) => {
    const [slots, classes, subjects] = await Promise.all([
      tx.timetableSlot.findMany({
        where: { institutionId: institution.id },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      tx.subject.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, classId: true },
      }),
    ]);
    return { slots, classes, subjects };
  });

  return <TimetableClient slots={slots} classes={classes} subjects={subjects} />;
}
