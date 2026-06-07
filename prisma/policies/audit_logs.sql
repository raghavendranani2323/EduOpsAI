-- Audit log table — appendable trail for admin/staff actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "actorUserId" TEXT NOT NULL,
  "institutionId" TEXT,
  action        TEXT NOT NULL,
  "targetId"    TEXT,
  meta          JSONB,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_institution_idx ON audit_logs ("institutionId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx       ON audit_logs ("actorUserId");

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only OWNER/ADMIN of the same institution can read; service_role bypasses
DROP POLICY IF EXISTS audit_logs_read ON audit_logs;
CREATE POLICY audit_logs_read ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."userId" = auth.uid()::text
        AND m."revokedAt" IS NULL
        AND m.role IN ('OWNER','ADMIN')
        AND m."institutionId" = audit_logs."institutionId"
    )
  );

GRANT ALL ON audit_logs TO service_role;
GRANT SELECT ON audit_logs TO authenticated;
