"use client";

import { createContext, useContext } from "react";
import type { Institution } from "@prisma/client";
import { getTerminology, type Terminology } from "@/lib/i18n/terminology";

type Ctx = { institution: Institution; terminology: Terminology };
const InstitutionContext = createContext<Ctx | null>(null);

export function InstitutionProvider({
  institution,
  children,
}: {
  institution: Institution;
  children: React.ReactNode;
}) {
  return (
    <InstitutionContext.Provider
      value={{ institution, terminology: getTerminology(institution.type) }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution(): Ctx {
  const ctx = useContext(InstitutionContext);
  if (!ctx) throw new Error("useInstitution must be inside InstitutionProvider");
  return ctx;
}

export function useTerminology(): Terminology {
  return useInstitution().terminology;
}
