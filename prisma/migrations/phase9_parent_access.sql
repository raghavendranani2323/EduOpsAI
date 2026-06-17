-- Phase 9: parent bearer-link lifecycle and audit history.
-- Apply after phase8_admissions_crm.sql.
-- Existing non-null portal tokens receive a 30-day expiry from migration time.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS "portalTokenCreatedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "portalTokenExpiresAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "portalTokenRevokedAt" TIMESTAMPTZ;

UPDATE students
SET
  "portalTokenCreatedAt" = COALESCE("portalTokenCreatedAt", NOW()),
  "portalTokenExpiresAt" = COALESCE("portalTokenExpiresAt", NOW() + INTERVAL '30 days')
WHERE "portalToken" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParentAccessEventAction') THEN
    CREATE TYPE "ParentAccessEventAction" AS ENUM (
      'GENERATED', 'ROTATED', 'REVOKED', 'VIEWED', 'EXPIRED', 'DENIED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS parent_access_events (
  id TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  "actorUserId" TEXT,
  action "ParentAccessEventAction" NOT NULL,
  meta JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS parent_access_events_student_created_idx
  ON parent_access_events ("institutionId", "studentId", "createdAt");

ALTER TABLE parent_access_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_access_events_select ON parent_access_events;
DROP POLICY IF EXISTS parent_access_events_insert ON parent_access_events;
CREATE POLICY parent_access_events_select ON parent_access_events FOR SELECT
  USING (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY parent_access_events_insert ON parent_access_events FOR INSERT
  WITH CHECK (
    has_role("institutionId", 'OWNER', 'ADMIN')
    AND ("actorUserId" IS NULL OR "actorUserId" = current_user_id())
  );

-- Rollback:
-- Drop parent_access_events and its enum, then remove the three lifecycle
-- columns. Revoked/expired tokens must not be re-enabled during rollback.
-- Staging verification: generate, rotate, revoke, expire, invalid-token,
-- sibling-phone, changed-phone, multi-child, and audit-isolation scenarios.
