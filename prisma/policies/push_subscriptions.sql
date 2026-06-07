-- Push subscriptions table (Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  "userId"   TEXT,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  ua         TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions ("userId");

-- RLS: only service role writes/reads (no end-user direct access)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_service_role ON push_subscriptions;
CREATE POLICY push_subscriptions_service_role
  ON push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON push_subscriptions TO service_role;

-- Performance: search-by-phone indexes for parent OTP guardian lookup
CREATE INDEX IF NOT EXISTS guardians_phone_idx ON guardians (phone);

-- Students: speed up parent portal recent attendance query
CREATE INDEX IF NOT EXISTS attendance_records_student_id_idx ON attendance_records ("studentId");

-- Speed up filter queries on the fees page
CREATE INDEX IF NOT EXISTS invoices_institution_status_idx ON invoices ("institutionId", status);
CREATE INDEX IF NOT EXISTS invoices_institution_period_idx ON invoices ("institutionId", "periodStart", "periodEnd");

-- Speed up search/filter on students page
CREATE INDEX IF NOT EXISTS students_institution_status_class_idx ON students ("institutionId", status, "classId");
