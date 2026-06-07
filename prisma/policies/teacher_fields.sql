-- Add staff profile fields used by the AddTeacher sheet
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMPTZ;

-- Teacher ↔ Subject join
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id          TEXT PRIMARY KEY,
  "profileId" TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "subjectId" TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE ("profileId", "subjectId")
);
CREATE INDEX IF NOT EXISTS teacher_subjects_subject_id_idx ON teacher_subjects ("subjectId");

-- RLS: anyone in the institution can read teacher_subjects; only OWNER/ADMIN write.
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_subjects_select ON teacher_subjects;
CREATE POLICY teacher_subjects_select ON teacher_subjects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."userId" = auth.uid()::text
        AND m."revokedAt" IS NULL
        AND m."institutionId" IN (
          SELECT s."institutionId" FROM subjects s WHERE s.id = teacher_subjects."subjectId"
        )
    )
  );

DROP POLICY IF EXISTS teacher_subjects_write ON teacher_subjects;
CREATE POLICY teacher_subjects_write ON teacher_subjects
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."userId" = auth.uid()::text
        AND m."revokedAt" IS NULL
        AND m.role IN ('OWNER','ADMIN')
        AND m."institutionId" IN (
          SELECT s."institutionId" FROM subjects s WHERE s.id = teacher_subjects."subjectId"
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."userId" = auth.uid()::text
        AND m."revokedAt" IS NULL
        AND m.role IN ('OWNER','ADMIN')
        AND m."institutionId" IN (
          SELECT s."institutionId" FROM subjects s WHERE s.id = teacher_subjects."subjectId"
        )
    )
  );

GRANT ALL ON teacher_subjects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_subjects TO authenticated;
