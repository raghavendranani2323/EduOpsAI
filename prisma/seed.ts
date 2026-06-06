/**
 * Demo seeder — populates one realistic Indian school.
 * Usage: pnpm db:seed
 *
 * NOTE: requires DATABASE_URL in .env.local.
 * The seeder uses the service-role connection (bypasses RLS).
 * Calls Supabase Auth to create a demo owner user if missing.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_EMAIL = "demo@eduops.in";
const DEMO_PASSWORD = "demo1234";

// ── Indian-realistic data ──────────────────────────────────
const FIRST_NAMES_M = ["Aarav", "Vihaan", "Aditya", "Arjun", "Reyansh", "Krishna", "Ishaan", "Shaurya", "Atharv", "Advait", "Kabir", "Vivaan"];
const FIRST_NAMES_F = ["Aanya", "Diya", "Saanvi", "Pari", "Ananya", "Anvi", "Myra", "Sara", "Aadhya", "Kiara", "Anika", "Riya"];
const LAST_NAMES   = ["Sharma", "Verma", "Iyer", "Reddy", "Patel", "Gupta", "Singh", "Kumar", "Nair", "Rao", "Mehta", "Joshi", "Pillai", "Chowdhury"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomPhone(): string { return "+91" + String(70000 + Math.floor(Math.random() * 29999)) + String(10000 + Math.floor(Math.random() * 89999)); }

async function main() {
  console.log("🌱 Seeding demo data…");

  // 1. Create or find demo auth user
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  let demoUserId = existing.users.find((u) => u.email === DEMO_EMAIL)?.id;

  if (!demoUserId) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Sunita Sharma" },
    });
    if (error) throw error;
    demoUserId = created.user!.id;
    console.log(`  ✓ Created demo user: ${DEMO_EMAIL}`);
  } else {
    console.log(`  ✓ Demo user exists: ${DEMO_EMAIL}`);
  }

  // 2. Profile
  await prisma.profile.upsert({
    where: { id: demoUserId },
    create: { id: demoUserId, fullName: "Sunita Sharma", phone: "+919876543210" },
    update: { fullName: "Sunita Sharma" },
  });

  // 3. Clean prior demo institutions for this user
  const priorMemberships = await prisma.membership.findMany({
    where: { userId: demoUserId, institution: { isDemo: true } },
    include: { institution: true },
  });
  if (priorMemberships.length > 0) {
    await prisma.institution.deleteMany({
      where: { id: { in: priorMemberships.map((m) => m.institutionId) } },
    });
    console.log(`  ✓ Cleaned ${priorMemberships.length} prior demo institutions`);
  }

  // 4. Institution
  const institution = await prisma.institution.create({
    data: {
      name: "Sri Vidya Mandir School",
      type: "SCHOOL",
      city: "Chennai",
      state: "Tamil Nadu",
      board: "CBSE",
      isDemo: true,
      memberships: {
        create: { userId: demoUserId, role: "OWNER", acceptedAt: new Date() },
      },
    },
  });
  console.log(`  ✓ Institution: ${institution.name}`);

  const academicYear = "2025-26";

  // 5. Classes
  const classes = await Promise.all(
    ["Class 6 A", "Class 6 B", "Class 7 A", "Class 8 A"].map((name) =>
      prisma.class.create({
        data: { institutionId: institution.id, name, academicYear },
      })
    )
  );
  console.log(`  ✓ ${classes.length} classes`);

  // 6. Tags
  const tags = await Promise.all(
    [
      { label: "Scholarship", color: "#10b981" },
      { label: "Fee Risk",    color: "#ef4444" },
      { label: "New Admission", color: "#3b82f6" },
      { label: "High Priority", color: "#f59e0b" },
    ].map((t) => prisma.tag.create({ data: { institutionId: institution.id, ...t } }))
  );

  // 7. Students (20 per class = 80)
  console.log("  → seeding 80 students with guardians…");
  for (const cls of classes) {
    for (let i = 1; i <= 20; i++) {
      const gender: "MALE" | "FEMALE" = Math.random() < 0.55 ? "MALE" : "FEMALE";
      const first = gender === "MALE" ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
      const last  = pick(LAST_NAMES);
      const fullName = `${first} ${last}`;
      const guardianFirst = Math.random() < 0.5 ? "Rajesh" : "Priya";
      const guardian = await prisma.guardian.create({
        data: {
          institutionId: institution.id,
          fullName: `${guardianFirst} ${last}`,
          phone: randomPhone(),
        },
      });
      const student = await prisma.student.create({
        data: {
          institutionId: institution.id,
          fullName,
          admissionNo: `${cls.name.replace(/\s/g, "")}-${String(i).padStart(2, "0")}`,
          gender,
          classId: cls.id,
          guardians: {
            create: { guardianId: guardian.id, relation: guardianFirst === "Rajesh" ? "father" : "mother", isPrimary: true },
          },
          studentTags: i % 7 === 0
            ? { create: { tagId: tags[1].id } } // Fee Risk
            : i % 11 === 0
            ? { create: { tagId: tags[0].id } } // Scholarship
            : undefined,
        },
      });

      // 8. Monthly fee invoice for current month
      if (i % 3 !== 0) {
        // ~33% unpaid, rest paid/partial
        const status = i % 3 === 1 ? "PAID" : "UNPAID";
        const amount = 350000; // ₹3,500
        await prisma.invoice.create({
          data: {
            institutionId: institution.id,
            studentId: student.id,
            amountDue: amount,
            amountPaid: status === "PAID" ? amount : 0,
            status,
            periodStart: new Date(2025, 5, 1),
            periodEnd:   new Date(2025, 5, 30),
            dueDate:     new Date(2025, 5, 10),
            payments: status === "PAID" ? {
              create: {
                institutionId: institution.id,
                amount,
                mode: Math.random() < 0.5 ? "UPI" : "CASH",
                paidAt: new Date(2025, 5, 5 + Math.floor(Math.random() * 10)),
                recordedBy: demoUserId,
              },
            } : undefined,
          },
        });
      }
    }
  }

  // 9. Fee plan
  await prisma.feePlan.create({
    data: {
      institutionId: institution.id,
      name: "Monthly Tuition Fee",
      amount: 350000,
      cadence: "MONTHLY",
      lateFeeAmount: 10000,
      lateFeeAfterDays: 10,
    },
  });

  // 10. Leads
  console.log("  → seeding admission leads…");
  const leadData = [
    { studentName: "Kabir Mehta",   guardianName: "Arun Mehta",     stage: "NEW",             priority: "HOT",  source: "WALK_IN" },
    { studentName: "Saanvi Iyer",   guardianName: "Lakshmi Iyer",   stage: "CONTACTED",       priority: "WARM", source: "INSTAGRAM" },
    { studentName: "Aarav Patel",   guardianName: "Nikhil Patel",   stage: "DEMO_SCHEDULED",  priority: "HOT",  source: "REFERRAL" },
    { studentName: "Diya Reddy",    guardianName: "Suresh Reddy",   stage: "DEMO_ATTENDED",   priority: "WARM", source: "WALK_IN" },
    { studentName: "Aditya Joshi",  guardianName: "Manisha Joshi",  stage: "NEW",             priority: "COLD", source: "PHONE" },
    { studentName: "Pari Singh",    guardianName: "Vinod Singh",    stage: "CONVERTED",       priority: "HOT",  source: "WHATSAPP" },
  ] as const;

  for (const lead of leadData) {
    await prisma.lead.create({
      data: {
        institutionId: institution.id,
        studentName: lead.studentName,
        guardianName: lead.guardianName,
        phone: randomPhone(),
        interestedClass: pick(["Class 6", "Class 7", "Class 8", "Class 9"]),
        source: lead.source,
        priority: lead.priority,
        stage: lead.stage,
        nextFollowupAt: new Date(Date.now() + Math.floor(Math.random() * 5) * 86400000),
      },
    });
  }

  // 11. Message templates
  await prisma.messageTemplate.createMany({
    data: [
      { institutionId: institution.id, kind: "FEE_REMINDER", language: "en", body: "Dear {{guardian_name}}, fees of {{amount}} are due for {{student_name}} ({{class_name}}) by {{due_date}}. – {{institution_name}}" },
      { institutionId: institution.id, kind: "ABSENCE",      language: "en", body: "Dear {{guardian_name}}, {{student_name}} was absent today ({{date}}). Please inform the school if there is a reason. – {{institution_name}}" },
      { institutionId: institution.id, kind: "BIRTHDAY",     language: "en", body: "Happy Birthday {{student_name}}! 🎂 Wishing you a wonderful day from all of us at {{institution_name}}." },
    ],
  });

  console.log(`\n✅ Done. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
