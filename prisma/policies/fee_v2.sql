-- Institution: receipt-header + sibling-discount fields
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "addressLine1"  TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "addressLine2"  TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS pincode         TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "principalName" TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "gstNumber"     TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "logoUrl"       TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "receiptPrefix" TEXT  DEFAULT 'INV';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "receiptCounter" INT  DEFAULT 0;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS "siblingDiscounts" JSONB;

-- FeePlan: components-based + academic year + percent late fee
ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS "academicYearId" TEXT REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS "lateFeePercent" INT DEFAULT 0;  -- basis points (250 = 2.5%)
CREATE INDEX IF NOT EXISTS fee_plans_academic_year_idx ON fee_plans ("institutionId", "academicYearId");

-- FeePlanComponent: tuition / transport / lab / exam fee etc
CREATE TABLE IF NOT EXISTS fee_plan_components (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "planId"    TEXT NOT NULL REFERENCES fee_plans(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      INT  NOT NULL,             -- paise
  "isOptional" BOOLEAN DEFAULT FALSE,
  "order"     INT DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fee_plan_components_plan_idx ON fee_plan_components ("planId");

ALTER TABLE fee_plan_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fee_plan_components_select ON fee_plan_components;
CREATE POLICY fee_plan_components_select ON fee_plan_components
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fee_plans p
      JOIN memberships m ON m."institutionId" = p."institutionId"
      WHERE p.id = fee_plan_components."planId"
        AND m."userId" = auth.uid()::text
        AND m."revokedAt" IS NULL
    )
  );

DROP POLICY IF EXISTS fee_plan_components_write ON fee_plan_components;
CREATE POLICY fee_plan_components_write ON fee_plan_components
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fee_plans p
      JOIN memberships m ON m."institutionId" = p."institutionId"
      WHERE p.id = fee_plan_components."planId"
        AND m."userId" = auth.uid()::text
        AND m."revokedAt" IS NULL
        AND m.role IN ('OWNER','ADMIN','ACCOUNTANT')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fee_plans p
      JOIN memberships m ON m."institutionId" = p."institutionId"
      WHERE p.id = fee_plan_components."planId"
        AND m."userId" = auth.uid()::text
        AND m."revokedAt" IS NULL
        AND m.role IN ('OWNER','ADMIN','ACCOUNTANT')
    )
  );

GRANT ALL ON fee_plan_components TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_plan_components TO authenticated;

-- Invoice: receipt number once paid (auto-assigned by app)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_receipt_number_idx ON invoices ("institutionId", "receiptNumber") WHERE "receiptNumber" IS NOT NULL;

-- Payment: receipt linkage already implicit via invoiceId, but track WhatsApp share state
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "receiptSharedAt" TIMESTAMPTZ;
