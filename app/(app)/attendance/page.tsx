import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTerminology } from "@/lib/i18n/terminology";
import { todayIST, formatDateLong } from "@/lib/format/date";

export default async function AttendancePage() {
  const { user, institution } = await requireInstitution();
  const t = getTerminology(institution.type);
  const today = todayIST();

  const classes = await withRls(user.id, async (tx) => {
    const rows = await tx.class.findMany({
      where: { institutionId: institution.id },
      include: {
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        sessions: {
          where: { sessionDate: new Date(today) },
          include: {
            _count: { select: { records: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return rows;
  });

  const todayLabel = formatDateLong(today);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-xl">
      <div>
        <h1 className="text-xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{todayLabel}</p>
      </div>

      <div className="space-y-2">
        {classes.map((cls) => {
          const session  = cls.sessions[0];
          const marked   = !!session;
          const count    = session?._count.records ?? 0;
          const total    = cls._count.students;

          return (
            <Link
              key={cls.id}
              href={`/attendance/${cls.id}`}
              className="flex items-center gap-3 border rounded-xl p-4 hover:bg-muted/50 transition-colors"
            >
              {marked
                ? <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                : <Circle       className="h-6 w-6 text-muted-foreground shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{cls.name}</p>
                <p className="text-xs text-muted-foreground">
                  {marked
                    ? `Marked — ${count} / ${total} ${t.students.toLowerCase()}`
                    : `${total} ${t.students.toLowerCase()} · not marked`
                  }
                </p>
              </div>
              <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${marked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {marked ? "Done" : "Pending"}
              </span>
            </Link>
          );
        })}
      </div>

      {classes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">No {t.classes.toLowerCase()} found</p>
          <p className="text-sm">
            <Link href="/classes" className="text-primary underline">Add a {t.class.toLowerCase()}</Link> first.
          </p>
        </div>
      )}
    </div>
  );
}
