-- Shared API foundations: durable serverless-safe rate limiting.
-- This table is intentionally unavailable to anon/authenticated Data API roles.

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  "resetAt"   TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_reset_at_idx
  ON rate_limit_counters ("resetAt");

ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE rate_limit_counters FROM anon, authenticated;
GRANT ALL ON TABLE rate_limit_counters TO service_role;

-- Rollback:
-- DROP TABLE IF EXISTS rate_limit_counters;
