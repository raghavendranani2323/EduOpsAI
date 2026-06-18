import { readFile, writeFile } from "node:fs/promises";

const sources = [
  "prisma/migrations/phase4_attendance_integrity.sql",
  "prisma/migrations/phase4_secure_staff_invitations.sql",
  "prisma/migrations/phase5_api_foundations.sql",
  "prisma/migrations/phase6_permission_hardening.sql",
  "prisma/migrations/phase7_non_payment_data_integrity.sql",
  "prisma/migrations/phase8_admissions_crm.sql",
  "prisma/migrations/phase9_parent_access.sql",
  "prisma/migrations/phase10_communications_delivery.sql",
];

const header = `-- EduOps consolidated non-payment remediation for Supabase
-- Generated from the ordered phase SQL files. Safe to rerun after a backup.
-- Prerequisite: the base EduOps schema (through phase 3) already exists.
-- Payment integration tables and payment remediation are intentionally unchanged.
--
-- Supabase SQL Editor: run this entire file as one script.
-- The transaction makes the combined migration atomic. The transaction-scoped
-- advisory lock prevents two operators applying it concurrently.

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('eduops_non_payment_remediation'));
`;

const footer = `
-- Supabase Data API grants are explicit because new projects stopped exposing
-- newly created public tables by default on 30 May 2026.
REVOKE ALL ON TABLE rate_limit_counters, lead_activities, parent_access_events
  FROM anon;
GRANT ALL ON TABLE rate_limit_counters TO service_role;
GRANT SELECT, INSERT ON TABLE lead_activities, parent_access_events
  TO authenticated, service_role;

-- Harden policy helper functions. They remain in public for compatibility
-- with existing policies, but cannot be called by anonymous clients.
ALTER FUNCTION current_user_id() SET search_path = public, pg_temp;
ALTER FUNCTION is_member(text) SET search_path = public, pg_temp;
ALTER FUNCTION has_role(text, text[]) SET search_path = public, pg_temp;
ALTER FUNCTION can_access_class(text, text) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION current_user_id(), is_member(text),
  has_role(text, text[]), can_access_class(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_user_id(), is_member(text),
  has_role(text, text[]), can_access_class(text, text)
  TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS eduops_remediation_runs (
  version TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE eduops_remediation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eduops_remediation_runs FROM anon, authenticated;
GRANT ALL ON TABLE eduops_remediation_runs TO service_role;
INSERT INTO eduops_remediation_runs (version)
VALUES ('non-payment-2026-06-18')
ON CONFLICT (version) DO UPDATE SET "appliedAt" = EXCLUDED."appliedAt";

NOTIFY pgrst, 'reload schema';
COMMIT;
`;

const sections = [];
for (const source of sources) {
  let sql = await readFile(source, "utf8");
  sql = sql.replaceAll("CREATE INDEX CONCURRENTLY", "CREATE INDEX");
  sections.push(`\n-- BEGIN ${source}\n${sql.trim()}\n-- END ${source}\n`);
}

const outputPath = "prisma/migrations/supabase_non_payment_remediation_all.sql";
const generated = `${header}${sections.join("\n")}${footer}`;

if (process.argv.includes("--check")) {
  const existing = await readFile(outputPath, "utf8");
  if (existing !== generated) {
    throw new Error(`${outputPath} is out of date; run pnpm sql:consolidate`);
  }
  console.log(`Verified ${outputPath} matches its ordered source migrations`);
} else {
  await writeFile(outputPath, generated, "utf8");
  console.log(`Generated ${outputPath}`);
}
