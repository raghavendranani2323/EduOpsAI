-- ============================================================
-- EduOps AI - Phase 3 Academic Leadership
-- Adds academic years, class-level groups, section teachers, and
-- student leadership assignments for Indian school operations.
-- ============================================================

CREATE TABLE IF NOT EXISTS academic_years (
  id text PRIMARY KEY,
  "institutionId" text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  "startsOn" date,
  "endsOn" date,
  "isActive" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academic_years_institution_name_key UNIQUE ("institutionId", name)
);

CREATE TABLE IF NOT EXISTS class_groups (
  id text PRIMARY KEY,
  "institutionId" text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "academicYearId" text REFERENCES academic_years(id) ON DELETE SET NULL,
  name text NOT NULL,
  medium text,
  "classHeadId" text REFERENCES profiles(id) ON DELETE SET NULL,
  "classLeaderId" text REFERENCES students(id) ON DELETE SET NULL,
  "girlsLeaderId" text REFERENCES students(id) ON DELETE SET NULL,
  "boysLeaderId" text REFERENCES students(id) ON DELETE SET NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT class_groups_institution_year_name_key UNIQUE ("institutionId", "academicYearId", name)
);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS "classGroupId" text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS "academicYearId" text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS medium text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS "sectionTeacherId" text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS "sectionLeaderId" text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS "girlsLeaderId" text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS "boysLeaderId" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_classGroupId_fkey') THEN
    ALTER TABLE classes ADD CONSTRAINT "classes_classGroupId_fkey"
      FOREIGN KEY ("classGroupId") REFERENCES class_groups(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_academicYearId_fkey') THEN
    ALTER TABLE classes ADD CONSTRAINT "classes_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES academic_years(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_sectionTeacherId_fkey') THEN
    ALTER TABLE classes ADD CONSTRAINT "classes_sectionTeacherId_fkey"
      FOREIGN KEY ("sectionTeacherId") REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_sectionLeaderId_fkey') THEN
    ALTER TABLE classes ADD CONSTRAINT "classes_sectionLeaderId_fkey"
      FOREIGN KEY ("sectionLeaderId") REFERENCES students(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_girlsLeaderId_fkey') THEN
    ALTER TABLE classes ADD CONSTRAINT "classes_girlsLeaderId_fkey"
      FOREIGN KEY ("girlsLeaderId") REFERENCES students(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_boysLeaderId_fkey') THEN
    ALTER TABLE classes ADD CONSTRAINT "classes_boysLeaderId_fkey"
      FOREIGN KEY ("boysLeaderId") REFERENCES students(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS academic_years_institution_idx ON academic_years ("institutionId");
CREATE INDEX IF NOT EXISTS class_groups_institution_idx ON class_groups ("institutionId");
CREATE INDEX IF NOT EXISTS class_groups_year_idx ON class_groups ("academicYearId");
CREATE INDEX IF NOT EXISTS classes_class_group_idx ON classes ("classGroupId");
CREATE INDEX IF NOT EXISTS classes_academic_year_idx ON classes ("academicYearId");

-- Backfill existing section-level class rows into academic years and class groups.
INSERT INTO academic_years (id, "institutionId", name, "isActive", "createdAt", "updatedAt")
SELECT
  'ay_' || substr(md5(c."institutionId" || ':' || c."academicYear"), 1, 20),
  c."institutionId",
  c."academicYear",
  false,
  MIN(c."createdAt"),
  CURRENT_TIMESTAMP
FROM classes c
WHERE c."academicYear" IS NOT NULL
GROUP BY c."institutionId", c."academicYear"
ON CONFLICT ("institutionId", name) DO NOTHING;

INSERT INTO class_groups (id, "institutionId", "academicYearId", name, medium, "createdAt", "updatedAt")
SELECT
  'cg_' || substr(md5(c."institutionId" || ':' || c."academicYear" || ':' || c.name), 1, 20),
  c."institutionId",
  ay.id,
  c.name,
  MAX(c.medium),
  MIN(c."createdAt"),
  CURRENT_TIMESTAMP
FROM classes c
LEFT JOIN academic_years ay
  ON ay."institutionId" = c."institutionId"
 AND ay.name = c."academicYear"
GROUP BY c."institutionId", c."academicYear", c.name, ay.id
ON CONFLICT ("institutionId", "academicYearId", name) DO NOTHING;

UPDATE classes c
SET
  "academicYearId" = ay.id,
  "classGroupId" = cg.id
FROM academic_years ay
JOIN class_groups cg
  ON cg."academicYearId" = ay.id
WHERE ay."institutionId" = c."institutionId"
  AND ay.name = c."academicYear"
  AND cg.name = c.name
  AND (c."academicYearId" IS NULL OR c."classGroupId" IS NULL);

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ay_sel ON academic_years;
DROP POLICY IF EXISTS ay_ins ON academic_years;
DROP POLICY IF EXISTS ay_upd ON academic_years;
DROP POLICY IF EXISTS ay_del ON academic_years;
CREATE POLICY ay_sel ON academic_years FOR SELECT USING (is_member("institutionId"));
CREATE POLICY ay_ins ON academic_years FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY ay_upd ON academic_years FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY ay_del ON academic_years FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

DROP POLICY IF EXISTS cg_sel ON class_groups;
DROP POLICY IF EXISTS cg_ins ON class_groups;
DROP POLICY IF EXISTS cg_upd ON class_groups;
DROP POLICY IF EXISTS cg_del ON class_groups;
CREATE POLICY cg_sel ON class_groups FOR SELECT USING (is_member("institutionId"));
CREATE POLICY cg_ins ON class_groups FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY cg_upd ON class_groups FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY cg_del ON class_groups FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));
