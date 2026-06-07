import type { Prisma } from "@prisma/client";

/**
 * For a TEACHER, return the set of class IDs they are allowed to see —
 * any class where they're sectionTeacher, plus any class belonging to a
 * ClassGroup where they're classHead.
 *
 * For non-TEACHER roles, returns null meaning "no restriction".
 */
export async function getTeacherClassIds(
  tx: Prisma.TransactionClient,
  userId: string,
  institutionId: string,
  role: string,
): Promise<string[] | null> {
  if (role !== "TEACHER") return null;
  const [asSection, asHead] = await Promise.all([
    tx.class.findMany({
      where: { institutionId, sectionTeacherId: userId },
      select: { id: true },
    }),
    tx.class.findMany({
      where: {
        institutionId,
        classGroup: { classHeadId: userId },
      },
      select: { id: true },
    }),
  ]);
  return [...new Set([...asSection.map(c => c.id), ...asHead.map(c => c.id)])];
}
