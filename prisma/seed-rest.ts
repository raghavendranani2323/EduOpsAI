/**
 * REST-only demo seeder — uses Supabase Auth Admin API + Management API.
 * No DATABASE_URL or DB password needed.
 * Usage: pnpm db:seed:rest
 */
// tsx automatically loads .env.local — no dotenv import needed

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ACCESS_TOKEN  = process.env.SUPABASE_ACCESS_TOKEN!;
const PROJECT_REF   = SUPABASE_URL.match(/\/\/(.+?)\./)?.[1];

if (!SUPABASE_URL || !SERVICE_ROLE || !ACCESS_TOKEN || !PROJECT_REF) {
  console.error("Missing env vars. Check .env.local");
  process.exit(1);
}

const MGMT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const AUTH  = `${SUPABASE_URL}/auth/v1/admin`;

// ── helpers ──────────────────────────────────────────────────

function sq(s: string) { return `'${s.replace(/'/g, "''")}'`; } // safe quote
function uuid(): string { return crypto.randomUUID(); }

async function mgmt(sql: string): Promise<unknown[]> {
  const r = await fetch(MGMT, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Management API error:\n${text}\n\nSQL:\n${sql.slice(0, 400)}`);
  return JSON.parse(text);
}

async function authAdmin(path: string, body?: object): Promise<unknown> {
  const r = await fetch(`${AUTH}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json() as Record<string, unknown>;
  if (!r.ok) throw new Error(`Auth API error: ${JSON.stringify(data)}`);
  return data;
}

// ── data ─────────────────────────────────────────────────────

const FIRST_M = ["Aarav", "Vihaan", "Aditya", "Arjun", "Reyansh", "Krishna", "Ishaan", "Shaurya", "Atharv", "Advait", "Kabir", "Vivaan"];
const FIRST_F = ["Aanya", "Diya", "Saanvi", "Pari", "Ananya", "Anvi", "Myra", "Sara", "Aadhya", "Kiara", "Anika", "Riya"];
const LAST    = ["Sharma", "Verma", "Iyer", "Reddy", "Patel", "Gupta", "Singh", "Kumar", "Nair", "Rao", "Mehta", "Joshi", "Pillai", "Chowdhury"];

function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length]; }
function phone(seed: number): string {
  const n = 7000000000 + (seed * 137891 % 2999999);
  return `+91${n}`;
}

// ── main ─────────────────────────────────────────────────────

async function main() {
  console.log("🌱 EduOps REST seeder starting…\n");

  // 1. Auth user
  const { users } = await authAdmin("/users?per_page=1000") as { users: { id: string; email: string }[] };
  let demoUserId = users.find(u => u.email === "demo@eduops.in")?.id;

  if (demoUserId) {
    console.log(`  ✓ Auth user exists (${demoUserId})`);
  } else {
    const created = await authAdmin("/users", {
      email: "demo@eduops.in",
      password: "demo1234",
      email_confirm: true,
      user_metadata: { full_name: "Sunita Sharma" },
    }) as { id: string };
    demoUserId = created.id;
    console.log(`  ✓ Created demo auth user (${demoUserId})`);
  }

  // 2. Clean existing demo data for this user
  await mgmt(`
    DELETE FROM institutions
    WHERE "isDemo" = true
      AND id IN (
        SELECT "institutionId" FROM memberships WHERE "userId" = ${sq(demoUserId)}
      );
  `);
  console.log("  ✓ Cleaned prior demo data");

  // 3. Profile
  await mgmt(`
    INSERT INTO profiles (id, "fullName", phone, "createdAt", "updatedAt")
    VALUES (${sq(demoUserId)}, 'Sunita Sharma', '+919876543210', now(), now())
    ON CONFLICT (id) DO UPDATE SET "fullName" = 'Sunita Sharma', "updatedAt" = now();
  `);

  // 4. Institution
  const instId = uuid();
  await mgmt(`
    INSERT INTO institutions (id, name, type, city, state, board, "isDemo", "createdAt", "updatedAt")
    VALUES (${sq(instId)}, 'Sri Vidya Mandir School', 'SCHOOL'::"InstitutionType",
            'Chennai', 'Tamil Nadu', 'CBSE', true, now(), now());
  `);

  // 5. Owner membership
  await mgmt(`
    INSERT INTO memberships (id, "userId", "institutionId", role, "acceptedAt", "createdAt")
    VALUES (${sq(uuid())}, ${sq(demoUserId)}, ${sq(instId)}, 'OWNER'::"Role", now(), now());
  `);
  console.log("  ✓ Institution + owner membership");

  // 6. Academic year + classes
  const academicYearId = uuid();
  await mgmt(`
    INSERT INTO academic_years (id, "institutionId", name, "isActive", "createdAt", "updatedAt")
    VALUES (${sq(academicYearId)}, ${sq(instId)}, '2025-26', true, now(), now());
  `);
  const classNames = ["Class 6 A", "Class 6 B", "Class 7 A", "Class 8 A"];
  const classIds   = classNames.map(() => uuid());
  const classRows  = classNames.map((name, i) =>
    `(${sq(classIds[i])}, ${sq(instId)}, ${sq(name)}, ${sq(academicYearId)}, '2025-26', now(), now())`
  ).join(",\n    ");
  await mgmt(`
    INSERT INTO classes (id, "institutionId", name, "academicYearId", "academicYear", "createdAt", "updatedAt")
    VALUES ${classRows};
  `);
  console.log(`  ✓ ${classNames.length} classes`);

  // 7. Tags
  const tagDefs = [
    { label: "Scholarship",   color: "#10b981" },
    { label: "Fee Risk",      color: "#ef4444" },
    { label: "New Admission", color: "#3b82f6" },
    { label: "High Priority", color: "#f59e0b" },
  ];
  const tagIds = tagDefs.map(() => uuid());
  const tagRows = tagDefs.map((t, i) =>
    `(${sq(tagIds[i])}, ${sq(instId)}, ${sq(t.label)}, ${sq(t.color)})`
  ).join(",\n    ");
  await mgmt(`
    INSERT INTO tags (id, "institutionId", label, color)
    VALUES ${tagRows};
  `);

  // 8. Students + guardians + invoices + payments
  console.log("  → seeding 80 students…");
  const FEE_PLAN_ID = uuid();
  let studentCount = 0;
  let invoiceCount = 0;
  let paymentCount = 0;

  const studentRows: string[] = [];
  const guardianRows: string[] = [];
  const sgRows: string[] = [];
  const tagLinkRows: string[] = [];
  const invoiceRows: string[] = [];
  const paymentRows: string[] = [];

  for (let ci = 0; ci < classIds.length; ci++) {
    const classId = classIds[ci];
    for (let i = 1; i <= 20; i++) {
      const seed    = ci * 20 + i;
      const isMale  = seed % 3 !== 0;
      const first   = isMale ? pick(FIRST_M, seed) : pick(FIRST_F, seed);
      const last    = pick(LAST, seed + 5);
      const fullName = `${first} ${last}`;
      const admNo   = `${classNames[ci].replace(/\s/g, "")}-${String(i).padStart(2, "0")}`;
      const gender  = isMale ? "MALE" : "FEMALE";

      const sid = uuid();
      const gid = uuid();

      const gFirst = seed % 2 === 0 ? "Rajesh" : "Priya";
      const gName  = `${gFirst} ${last}`;
      const gPhone = phone(seed);
      const gRel   = gFirst === "Rajesh" ? "father" : "mother";

      studentRows.push(`(${sq(sid)}, ${sq(instId)}, ${sq(fullName)}, ${sq(admNo)}, ${sq(gender)}::"Gender", ${sq(classId)}, 'ACTIVE'::"StudentStatus", now(), now())`);
      guardianRows.push(`(${sq(gid)}, ${sq(instId)}, ${sq(gName)}, ${sq(gPhone)}, now())`);
      sgRows.push(`(${sq(sid)}, ${sq(gid)}, ${sq(gRel)}, true)`);

      // Tags: every 7th → Fee Risk, every 11th → Scholarship
      if (seed % 7 === 0) tagLinkRows.push(`(${sq(sid)}, ${sq(tagIds[1])})`);
      else if (seed % 11 === 0) tagLinkRows.push(`(${sq(sid)}, ${sq(tagIds[0])})`);

      // Invoice: skip every 3rd student (33% no invoice)
      if (seed % 3 !== 0) {
        const inv = uuid();
        const status = seed % 3 === 1 ? "PAID" : "UNPAID";
        const amount = 350000;
        const dayPaid = 5 + (seed % 10);
        invoiceRows.push(`(${sq(inv)}, ${sq(instId)}, ${sq(sid)}, ${sq(FEE_PLAN_ID)}, '2025-06-01', '2025-06-30', ${amount}, ${status === "PAID" ? amount : 0}, ${sq(status)}::"InvoiceStatus", '2025-06-10', now(), now())`);

        if (status === "PAID") {
          const mode = seed % 2 === 0 ? "UPI" : "CASH";
          const pid  = uuid();
          paymentRows.push(`(${sq(pid)}, ${sq(instId)}, ${sq(inv)}, ${amount}, ${sq(mode)}::"PaymentMode", '2025-06-${String(dayPaid).padStart(2,"0")}'::date, ${sq(demoUserId)}, now())`);
          paymentCount++;
        }
        invoiceCount++;
      }
      studentCount++;
    }
  }

  // Batch inserts — split large arrays to avoid huge queries
  const chunk = <T>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const rows of chunk(guardianRows, 20)) {
    await mgmt(`INSERT INTO guardians (id, "institutionId", "fullName", phone, "createdAt") VALUES ${rows.join(",\n")};`);
  }
  for (const rows of chunk(studentRows, 20)) {
    await mgmt(`INSERT INTO students (id, "institutionId", "fullName", "admissionNo", gender, "classId", status, "createdAt", "updatedAt") VALUES ${rows.join(",\n")};`);
  }
  for (const rows of chunk(sgRows, 40)) {
    await mgmt(`INSERT INTO student_guardians ("studentId", "guardianId", relation, "isPrimary") VALUES ${rows.join(",\n")};`);
  }
  if (tagLinkRows.length > 0) {
    await mgmt(`INSERT INTO student_tags ("studentId", "tagId") VALUES ${tagLinkRows.join(",\n")};`);
  }

  console.log(`  ✓ ${studentCount} students, ${tagLinkRows.length} tags assigned`);

  // 9. Fee plan
  await mgmt(`
    INSERT INTO fee_plans (id, "institutionId", name, amount, cadence, "lateFeeAmount", "lateFeeAfterDays", "createdAt", "updatedAt")
    VALUES (${sq(FEE_PLAN_ID)}, ${sq(instId)}, 'Monthly Tuition Fee', 350000, 'MONTHLY'::"Cadence", 10000, 10, now(), now());
  `);

  // 10. Invoices + payments
  for (const rows of chunk(invoiceRows, 20)) {
    await mgmt(`INSERT INTO invoices (id, "institutionId", "studentId", "feePlanId", "periodStart", "periodEnd", "amountDue", "amountPaid", status, "dueDate", "createdAt", "updatedAt") VALUES ${rows.join(",\n")};`);
  }
  for (const rows of chunk(paymentRows, 20)) {
    await mgmt(`INSERT INTO payments (id, "institutionId", "invoiceId", amount, mode, "paidAt", "recordedBy", "createdAt") VALUES ${rows.join(",\n")};`);
  }
  console.log(`  ✓ ${invoiceCount} invoices, ${paymentCount} payments`);

  // 11. Leads
  const leads = [
    { sn: "Kabir Mehta",   gn: "Arun Mehta",     stage: "NEW",            pri: "HOT",  src: "WALK_IN",   cls: "Class 6" },
    { sn: "Saanvi Iyer",   gn: "Lakshmi Iyer",   stage: "CONTACTED",      pri: "WARM", src: "INSTAGRAM", cls: "Class 7" },
    { sn: "Aarav Patel",   gn: "Nikhil Patel",   stage: "DEMO_SCHEDULED", pri: "HOT",  src: "REFERRAL",  cls: "Class 6" },
    { sn: "Diya Reddy",    gn: "Suresh Reddy",   stage: "DEMO_ATTENDED",  pri: "WARM", src: "WALK_IN",   cls: "Class 8" },
    { sn: "Aditya Joshi",  gn: "Manisha Joshi",  stage: "NEW",            pri: "COLD", src: "PHONE",     cls: "Class 9" },
    { sn: "Pari Singh",    gn: "Vinod Singh",    stage: "CONVERTED",      pri: "HOT",  src: "WHATSAPP",  cls: "Class 7" },
  ];
  const leadRows = leads.map((l, i) =>
    `(${sq(uuid())}, ${sq(instId)}, ${sq(l.sn)}, ${sq(l.gn)}, ${sq(phone(500 + i))}, ${sq(l.cls)}, ${sq(l.src)}::"LeadSource", ${sq(l.pri)}::"Priority", ${sq(l.stage)}::"LeadStage", now() + interval '${i + 1} days', now(), now())`
  ).join(",\n    ");
  await mgmt(`
    INSERT INTO leads (id, "institutionId", "studentName", "guardianName", phone, "interestedClass", source, priority, stage, "nextFollowupAt", "createdAt", "updatedAt")
    VALUES ${leadRows};
  `);
  console.log("  ✓ 6 admission leads");

  // 12. Message templates
  const templates = [
    { kind: "FEE_REMINDER", body: "Dear {{guardian_name}}, fees of {{amount}} are due for {{student_name}} ({{class_name}}) by {{due_date}}. – {{institution_name}}" },
    { kind: "ABSENCE",      body: "Dear {{guardian_name}}, {{student_name}} was absent today ({{date}}). Please inform the school if there is a reason. – {{institution_name}}" },
    { kind: "BIRTHDAY",     body: "Happy Birthday {{student_name}}! Wishing you a wonderful day from all of us at {{institution_name}}." },
  ];
  const tmplRows = templates.map(t =>
    `(${sq(uuid())}, ${sq(instId)}, ${sq(t.kind)}::"TemplateKind", 'en', ${sq(t.body)}, now(), now())`
  ).join(",\n    ");
  await mgmt(`
    INSERT INTO message_templates (id, "institutionId", kind, language, body, "createdAt", "updatedAt")
    VALUES ${tmplRows};
  `);
  console.log("  ✓ 3 message templates");

  console.log(`
✅ Seeding complete!
   Login:       demo@eduops.in / demo1234
   Institution: Sri Vidya Mandir School (Chennai, CBSE)
   Students:    ${studentCount} across 4 classes
   Invoices:    ${invoiceCount} (mix of paid/unpaid)
`);
}

main().catch(e => { console.error(e); process.exit(1); });
