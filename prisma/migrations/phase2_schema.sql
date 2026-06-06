-- Phase 2 schema additions

-- SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "classId"       TEXT REFERENCES classes(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  code            TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXAMS
CREATE TABLE IF NOT EXISTS exams (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "classId"       TEXT REFERENCES classes(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  "examDate"      TIMESTAMPTZ,
  "totalMarks"    INT NOT NULL DEFAULT 100,
  "passingMarks"  INT NOT NULL DEFAULT 35,
  "academicYear"  TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXAM RESULTS
CREATE TABLE IF NOT EXISTS exam_results (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "examId"        TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  "studentId"     TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  "subjectId"     TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  "marksObtained" FLOAT,
  grade           TEXT,
  remarks         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("examId", "studentId", "subjectId")
);

-- TIMETABLE SLOTS
CREATE TABLE IF NOT EXISTS timetable_slots (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "classId"       TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  "subjectId"     TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  "teacherId"     TEXT,
  "dayOfWeek"     INT NOT NULL,
  "startTime"     TEXT NOT NULL,
  "endTime"       TEXT NOT NULL,
  label           TEXT
);

-- HOMEWORK
CREATE TABLE IF NOT EXISTS homework (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "classId"       TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  "subjectId"     TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  "teacherId"     TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  "dueDate"       TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTICES
CREATE TABLE IF NOT EXISTS notices (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "authorId"      TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  audience        TEXT NOT NULL DEFAULT 'ALL',
  "classId"       TEXT,
  pinned          BOOLEAN NOT NULL DEFAULT FALSE,
  "publishedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt"     TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS leave_requests (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "userId"        TEXT NOT NULL,
  "leaveType"     TEXT NOT NULL DEFAULT 'CASUAL',
  "fromDate"      TIMESTAMPTZ NOT NULL,
  "toDate"        TIMESTAMPTZ NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  "approvedBy"    TEXT,
  "approvedAt"    TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies for new tables
ALTER TABLE subjects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Helper: institution membership check (same pattern as Phase 1)
CREATE POLICY "subjects_tenant" ON subjects USING (
  "institutionId" IN (SELECT "institutionId" FROM memberships WHERE "userId" = auth.uid()::text AND "revokedAt" IS NULL)
);
CREATE POLICY "exams_tenant" ON exams USING (
  "institutionId" IN (SELECT "institutionId" FROM memberships WHERE "userId" = auth.uid()::text AND "revokedAt" IS NULL)
);
CREATE POLICY "exam_results_tenant" ON exam_results USING (
  "institutionId" IN (SELECT "institutionId" FROM memberships WHERE "userId" = auth.uid()::text AND "revokedAt" IS NULL)
);
CREATE POLICY "timetable_tenant" ON timetable_slots USING (
  "institutionId" IN (SELECT "institutionId" FROM memberships WHERE "userId" = auth.uid()::text AND "revokedAt" IS NULL)
);
CREATE POLICY "homework_tenant" ON homework USING (
  "institutionId" IN (SELECT "institutionId" FROM memberships WHERE "userId" = auth.uid()::text AND "revokedAt" IS NULL)
);
CREATE POLICY "notices_tenant" ON notices USING (
  "institutionId" IN (SELECT "institutionId" FROM memberships WHERE "userId" = auth.uid()::text AND "revokedAt" IS NULL)
);
CREATE POLICY "leave_requests_tenant" ON leave_requests USING (
  "institutionId" IN (SELECT "institutionId" FROM memberships WHERE "userId" = auth.uid()::text AND "revokedAt" IS NULL)
);
