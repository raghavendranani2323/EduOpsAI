import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Megaphone, Check } from "lucide-react";
import { randomBytes } from "crypto";
import { prismaAdmin } from "@/lib/prisma/admin";
import { formatDate } from "@/lib/format/date";
import { isParentTokenActive } from "@/lib/parent/access";
import { InvalidParentLink } from "../../invalid-link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ParentNoticePage({
  params,
}: {
  params: Promise<{ token: string; noticeId: string }>;
}) {
  const { token, noticeId } = await params;

  const student = await prismaAdmin.student.findFirst({
    where: { portalToken: token, status: "ACTIVE" },
    select: {
      id: true,
      fullName: true,
      institutionId: true,
      classId: true,
      portalToken: true,
      portalTokenExpiresAt: true,
      portalTokenRevokedAt: true,
    },
  });
  if (!student) return <InvalidParentLink />;
  if (!isParentTokenActive(student)) return <InvalidParentLink expired />;

  const notice = await prismaAdmin.notice.findFirst({
    where: {
      id: noticeId,
      institutionId: student.institutionId,
      audience: { in: ["ALL", "PARENTS", "CLASS"] },
      OR: [
        { audience: { not: "CLASS" } },
        { classId: student.classId },
      ],
    },
  });
  if (!notice) notFound();

  // Record read (idempotent via unique constraint)
  try {
    await prismaAdmin.noticeRead.upsert({
      where: { noticeId_studentId: { noticeId: notice.id, studentId: student.id } },
      create: { id: randomBytes(12).toString("base64url"), noticeId: notice.id, studentId: student.id },
      update: {}, // first-read time is preserved
    });
  } catch {
    // swallow — read tracking is best-effort
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground px-4 py-4 flex items-center gap-3">
        <Link href={`/p/${token}`} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <Megaphone className="h-5 w-5" />
        <h1 className="font-semibold flex-1 truncate">Notice</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <article className="bg-card border rounded-xl p-5 space-y-3">
          <div>
            <h2 className="font-bold text-lg">{notice.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(notice.publishedAt.toISOString().split("T")[0])}
            </p>
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{notice.body}</p>
          <div className="flex items-center gap-1.5 text-xs text-green-700 pt-2 border-t">
            <Check className="h-3.5 w-3.5" />
            Marked as read for {student.fullName}
          </div>
        </article>
      </main>
    </div>
  );
}
