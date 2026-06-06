import type { InstitutionType } from "@prisma/client";

export type Terminology = {
  students: string;
  student: string;
  classes: string;
  class: string;
  guardian: string;
  staff: string;
  head: string;
  fees: string;
  admissions: string;
};

const TERMINOLOGY: Record<InstitutionType, Terminology> = {
  SCHOOL: {
    students: "Students",
    student: "Student",
    classes: "Classes",
    class: "Class",
    guardian: "Parent / Guardian",
    staff: "Staff",
    head: "Principal",
    fees: "School Fees",
    admissions: "Admissions",
  },
  COACHING: {
    students: "Students",
    student: "Student",
    classes: "Batches",
    class: "Batch",
    guardian: "Parent",
    staff: "Faculty",
    head: "Director",
    fees: "Fees",
    admissions: "Admissions",
  },
  PRESCHOOL: {
    students: "Children",
    student: "Child",
    classes: "Groups",
    class: "Group",
    guardian: "Parent",
    staff: "Teachers",
    head: "Head Teacher",
    fees: "Monthly Fees",
    admissions: "Enrolments",
  },
  TUITION: {
    students: "Students",
    student: "Student",
    classes: "Batches",
    class: "Batch",
    guardian: "Parent",
    staff: "Tutors",
    head: "Centre Head",
    fees: "Tuition Fees",
    admissions: "Admissions",
  },
};

export function getTerminology(type: InstitutionType): Terminology {
  return TERMINOLOGY[type] ?? TERMINOLOGY.SCHOOL;
}
