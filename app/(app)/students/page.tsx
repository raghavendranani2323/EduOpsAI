import Link from "next/link";
import { Suspense } from "react";
import { Upload } from "lucide-react";
import { requireInstitution } from "@/lib/tenant/current";
import { withRls } from "@/lib/prisma/rls";
import { getTerminology } from "@/lib/i18n/terminology";
import { StudentsClient } from "./students-client";

const PAGE_SIZE = 50;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; classId?: string; status?: string; cursor?: string }>;
}) {
  const { user, institution } = await requireInstitution();
  const t = getTerminology(institution.type);
  const sp = await searchParams;

  const q       = sp.q?.trim() ?? "";
  const classId = sp.classId ?? "";
  const status  = (sp.status ?? "ACTIVE") as "ACTIVE" | "ARCHIVED" | "ALL";
  const cursor  = sp.cursor ?? "";

  const { students, classes, total } = await withRls(user.id, async (tx) => {
    const where = {
      institutionId: institution.id,
      ...(status !== "ALL" ? { status: status as "ACTIVE" | "ARCHIVED" } : {}),
      ...(classId ? { classId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { admissionNo: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, count, allClasses] = await Promise.all([
      tx.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          studentTags: { include: { tag: true } },
          guardians: {
            where: { isPrimary: true },
            include: { guardian: { select: { fullName: true, phone: true } } },
            take: 1,
          },
        },
        orderBy: { fullName: "asc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      tx.student.count({ where }),
      tx.class.findMany({
        where: { institutionId: institution.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    return { students: rows, total: count, classes: allClasses };
  });

  const hasMore  = students.length > PAGE_SIZE;
  const page     = hasMore ? students.slice(0, PAGE_SIZE) : students;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.students}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/students/import"
            className="flex items-center gap-1.5 border rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-muted transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Link>
          <Link
            href="/students/new"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]"
          >
            + {t.student}
          </Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <StudentsClient
          students={page}
          classes={classes}
          total={total}
          nextCursor={nextCursor}
          currentFilters={{ q, classId, status }}
          terminology={t}
        />
      </Suspense>
    </div>
  );
}
