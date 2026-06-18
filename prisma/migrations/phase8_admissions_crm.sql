-- Phase 8: focused admissions CRM workflow.
-- Apply after phase7_non_payment_data_integrity.sql.
-- Preconditions: back up staging; confirm all assigned staff IDs are active
-- institution members. This migration does not rewrite or delete lead data.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT,
  ADD COLUMN IF NOT EXISTS "lostReason" TEXT,
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_assignedToId_fkey'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT "leads_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadActivityKind') THEN
    CREATE TYPE "LeadActivityKind" AS ENUM (
      'CREATED', 'NOTE', 'CALL', 'WHATSAPP', 'STAGE_CHANGED',
      'FOLLOWUP_CHANGED', 'OWNER_CHANGED', 'CONVERTED', 'LINKED_EXISTING'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lead_activities (
  id TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "leadId" TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  "actorUserId" TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kind "LeadActivityKind" NOT NULL,
  note TEXT,
  meta JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_institution_owner_followup_idx
  ON leads ("institutionId", "assignedToId", "nextFollowupAt");
CREATE INDEX IF NOT EXISTS lead_activities_lead_created_idx
  ON lead_activities ("institutionId", "leadId", "createdAt");
CREATE INDEX IF NOT EXISTS lead_activities_actor_created_idx
  ON lead_activities ("institutionId", "actorUserId", "createdAt");

CREATE OR REPLACE FUNCTION enforce_lead_owner_scope() RETURNS trigger AS $$
BEGIN
  IF NEW."assignedToId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m."userId" = NEW."assignedToId"
      AND m."institutionId" = NEW."institutionId"
      AND m."revokedAt" IS NULL
      AND m.role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Lead owner must be an active owner or admin in the institution';
  END IF;
  IF NEW.stage = 'LOST' AND COALESCE(btrim(NEW."lostReason"), '') = '' THEN
    RAISE EXCEPTION 'Lost reason is required';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_owner_scope ON leads;
CREATE TRIGGER leads_owner_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "assignedToId", stage, "lostReason"
  ON leads FOR EACH ROW EXECUTE FUNCTION enforce_lead_owner_scope();

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_activity_select ON lead_activities;
DROP POLICY IF EXISTS lead_activity_insert ON lead_activities;
CREATE POLICY lead_activity_select ON lead_activities FOR SELECT
  USING (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY lead_activity_insert ON lead_activities FOR INSERT
  WITH CHECK (
    has_role("institutionId", 'OWNER', 'ADMIN')
    AND "actorUserId" = current_user_id()
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_activities."leadId"
        AND l."institutionId" = lead_activities."institutionId"
    )
  );

-- Rollback:
-- Drop lead_activities, leads_owner_scope/enforce_lead_owner_scope, the owner
-- index/FK, then the three added lead columns. Retain exported activity data.
-- Staging verification: test duplicate warnings, owner tenant scope, required
-- lost reason, activity isolation, conversion conflicts, and rollback.
