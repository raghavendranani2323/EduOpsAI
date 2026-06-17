import { prismaAdmin } from "@/lib/prisma/admin";
import { phoneVariants } from "./config";
import { isParentTokenActive } from "./access";

export interface ParentChild {
  id: string;
  fullName: string;
  admissionNo: string | null;
  portalToken: string | null;
  className: string | null;
  institutionName: string;
  guardianRelation: string | null;
}

export async function findChildrenForPhone(phone: string): Promise<ParentChild[]> {
  const variants = phoneVariants(phone);
  const guardians = await prismaAdmin.guardian.findMany({
    where: { phone: { in: variants } },
    include: {
      students: {
        where: { student: { status: "ACTIVE" } },
        include: {
          student: {
            include: {
              class:       { select: { name: true } },
              institution: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const out: ParentChild[] = [];
  for (const g of guardians) {
    for (const link of g.students) {
      const s = link.student;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push({
        id: s.id,
        fullName: s.fullName,
        admissionNo: s.admissionNo,
        portalToken: isParentTokenActive(s) ? s.portalToken : null,
        className: s.class?.name ?? null,
        institutionName: s.institution.name,
        guardianRelation: link.relation ?? null,
      });
    }
  }
  return out;
}
