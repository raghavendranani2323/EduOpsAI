import { Client } from "pg";

const client = new Client({
  connectionString: "postgresql://postgres.bppouwvjljwjijveavuq:Raghava6556%40@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres",
});

await client.connect();
await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS "portalToken" TEXT`);
await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS students_portalToken_key ON students("portalToken")`);
console.log("portalToken column applied");
await client.end();
