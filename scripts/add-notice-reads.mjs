import { Client } from "pg";

const client = new Client({
  connectionString: "postgresql://postgres.bppouwvjljwjijveavuq:Raghava6556%40@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres",
});

await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS notice_reads (
    id          TEXT PRIMARY KEY,
    "noticeId"  TEXT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    "studentId" TEXT NOT NULL,
    "readAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    UNIQUE("noticeId", "studentId")
  );
`);
await client.query(`CREATE INDEX IF NOT EXISTS notice_reads_studentId_idx ON notice_reads("studentId");`);

// Enable RLS — admins read via withRls; writes happen only via prismaAdmin from /p/ route.
await client.query(`ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;`);
await client.query(`
  DROP POLICY IF EXISTS "notice_reads_select_by_membership" ON notice_reads;
  CREATE POLICY "notice_reads_select_by_membership" ON notice_reads
    FOR SELECT TO authenticated, app_user
    USING (
      "noticeId" IN (
        SELECT n.id FROM notices n
        WHERE n."institutionId" IN (
          SELECT m."institutionId" FROM memberships m
          WHERE m."userId" = (current_setting('request.jwt.claims', true)::json->>'sub')::text
            AND m."revokedAt" IS NULL
        )
      )
    );
`);
console.log("notice_reads created");
await client.end();
