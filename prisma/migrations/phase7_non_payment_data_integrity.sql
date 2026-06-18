-- Phase 7: non-payment data integrity and operational indexes.
--
-- Purpose:
--   Backfill authoritative class academic-year relations, reject ambiguous
--   duplicates/cross-tenant references, add scoped uniqueness and query
--   indexes, and enforce tenant/relationship integrity at the database layer.
-- Preconditions:
--   Apply after phase5_api_foundations.sql and phase6_permission_hardening.sql.
--   Back up the database and run the audit queries in the Phase 3 report.
-- Backfill:
--   Missing academic_year rows are created from the legacy classes.academicYear
--   label, then classes.academicYearId is populated. No ambiguous rows are
--   deleted or merged.
-- RLS:
--   Existing policies remain in force. notice_reads receives explicit policies.
-- Lock/performance:
--   Index creation and foreign-key validation can lock populated tables. Apply
--   in a maintenance window after reviewing duplicate-check output.
-- Rollback:
--   See the end of this file. Data backfilled into academic_years/classes is
--   intentionally retained because it is non-destructive.

INSERT INTO academic_years (
  id, "institutionId", name, "isActive", "createdAt", "updatedAt"
)
SELECT
  'ay_' || substr(md5(c."institutionId" || ':' || btrim(c."academicYear")), 1, 20),
  c."institutionId",
  btrim(c."academicYear"),
  false,
  MIN(c."createdAt"),
  CURRENT_TIMESTAMP
FROM classes c
WHERE c."academicYearId" IS NULL
  AND btrim(c."academicYear") <> ''
GROUP BY c."institutionId", btrim(c."academicYear")
ON CONFLICT ("institutionId", name) DO NOTHING;

UPDATE classes c
SET "academicYearId" = ay.id
FROM academic_years ay
WHERE c."academicYearId" IS NULL
  AND ay."institutionId" = c."institutionId"
  AND ay.name = btrim(c."academicYear");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM students
    WHERE "admissionNo" IS NOT NULL AND btrim("admissionNo") <> ''
    GROUP BY "institutionId", lower(btrim("admissionNo"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate institution admission numbers must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM timetable_slots
    GROUP BY "classId", "dayOfWeek", btrim("startTime")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate timetable start slots must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM timetable_slots a
    JOIN timetable_slots b
      ON a.id < b.id
     AND a."dayOfWeek" = b."dayOfWeek"
     AND (
       a."classId" = b."classId"
       OR (a."teacherId" IS NOT NULL AND a."teacherId" = b."teacherId")
     )
     AND a."startTime" < b."endTime"
     AND a."endTime" > b."startTime"
  ) THEN
    RAISE EXCEPTION 'Overlapping timetable slots must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM classes
    WHERE "classGroupId" IS NOT NULL
    GROUP BY "classGroupId", lower(COALESCE(NULLIF(btrim(section), ''), '__default__'))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate class sections must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invitations
    WHERE "acceptedAt" IS NULL
    GROUP BY "institutionId", lower(btrim(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pending invitations must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM attendance_records
    GROUP BY "sessionId", "studentId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate attendance records must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM student_guardians
    GROUP BY "studentId", "guardianId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate student guardian links must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM notice_reads
    GROUP BY "noticeId", "studentId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate notice reads must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM exam_results
    GROUP BY "examId", "studentId", "subjectId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate exam results must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM push_subscriptions
    GROUP BY endpoint HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate push endpoints must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM classes c
    JOIN academic_years ay ON ay.id = c."academicYearId"
    WHERE ay."institutionId" <> c."institutionId"
       OR ay.name <> c."academicYear"
  ) THEN
    RAISE EXCEPTION 'Class academic-year mirrors are inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM classes c
    JOIN class_groups cg ON cg.id = c."classGroupId"
    WHERE cg."institutionId" <> c."institutionId"
       OR (
         c."academicYearId" IS NOT NULL
         AND cg."academicYearId" IS DISTINCT FROM c."academicYearId"
       )
  ) THEN
    RAISE EXCEPTION 'Class group tenant/year references are inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM notice_reads nr
    LEFT JOIN notices n ON n.id = nr."noticeId"
    LEFT JOIN students s ON s.id = nr."studentId"
    WHERE n.id IS NULL OR s.id IS NULL OR n."institutionId" <> s."institutionId"
  ) THEN
    RAISE EXCEPTION 'Invalid notice read references must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM students s
    JOIN classes c ON c.id = s."classId"
    WHERE c."institutionId" <> s."institutionId"
  ) OR EXISTS (
    SELECT 1
    FROM student_guardians sg
    JOIN students s ON s.id = sg."studentId"
    JOIN guardians g ON g.id = sg."guardianId"
    WHERE s."institutionId" <> g."institutionId"
  ) OR EXISTS (
    SELECT 1
    FROM attendance_sessions a
    JOIN classes c ON c.id = a."classId"
    WHERE c."institutionId" <> a."institutionId"
  ) OR EXISTS (
    SELECT 1
    FROM attendance_records ar
    JOIN attendance_sessions a ON a.id = ar."sessionId"
    JOIN students s ON s.id = ar."studentId"
    WHERE s."institutionId" <> a."institutionId"
       OR s."classId" IS DISTINCT FROM a."classId"
  ) OR EXISTS (
    SELECT 1
    FROM exam_results er
    JOIN exams e ON e.id = er."examId"
    JOIN students s ON s.id = er."studentId"
    JOIN subjects sub ON sub.id = er."subjectId"
    WHERE er."institutionId" <> e."institutionId"
       OR er."institutionId" <> s."institutionId"
       OR er."institutionId" <> sub."institutionId"
       OR (e."classId" IS NOT NULL AND s."classId" IS DISTINCT FROM e."classId")
       OR (sub."classId" IS NOT NULL AND sub."classId" IS DISTINCT FROM e."classId")
  ) OR EXISTS (
    SELECT 1
    FROM homework h
    JOIN classes c ON c.id = h."classId"
    LEFT JOIN subjects sub ON sub.id = h."subjectId"
    WHERE h."institutionId" <> c."institutionId"
       OR (sub.id IS NOT NULL AND (
         sub."institutionId" <> h."institutionId"
         OR (sub."classId" IS NOT NULL AND sub."classId" <> h."classId")
       ))
       OR NOT EXISTS (
         SELECT 1 FROM memberships m
         WHERE m."userId" = h."teacherId"
           AND m."institutionId" = h."institutionId"
           AND m."revokedAt" IS NULL
           AND m.role IN ('OWNER', 'ADMIN', 'TEACHER')
       )
  ) OR EXISTS (
    SELECT 1
    FROM timetable_slots t
    JOIN classes c ON c.id = t."classId"
    LEFT JOIN subjects sub ON sub.id = t."subjectId"
    WHERE t."institutionId" <> c."institutionId"
       OR (sub.id IS NOT NULL AND (
         sub."institutionId" <> t."institutionId"
         OR (sub."classId" IS NOT NULL AND sub."classId" <> t."classId")
       ))
       OR (
         t."teacherId" IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM memberships m
           WHERE m."userId" = t."teacherId"
             AND m."institutionId" = t."institutionId"
             AND m."revokedAt" IS NULL
             AND m.role IN ('OWNER', 'ADMIN', 'TEACHER')
         )
       )
  ) OR EXISTS (
    SELECT 1
    FROM notices n
    LEFT JOIN classes c ON c.id = n."classId"
    WHERE (n."classId" IS NOT NULL AND c.id IS NULL)
       OR (c.id IS NOT NULL AND c."institutionId" <> n."institutionId")
       OR NOT EXISTS (
         SELECT 1 FROM memberships m
         WHERE m."userId" = n."authorId"
           AND m."institutionId" = n."institutionId"
           AND m."revokedAt" IS NULL
       )
  ) THEN
    RAISE EXCEPTION 'Cross-tenant or cross-class references must be resolved before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS students_institution_admission_no_key
  ON students ("institutionId", lower(btrim("admissionNo")))
  WHERE "admissionNo" IS NOT NULL AND btrim("admissionNo") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS timetable_class_day_start_key
  ON timetable_slots ("classId", "dayOfWeek", btrim("startTime"));

CREATE UNIQUE INDEX IF NOT EXISTS classes_group_section_key
  ON classes (
    "classGroupId",
    lower(COALESCE(NULLIF(btrim(section), ''), '__default__'))
  )
  WHERE "classGroupId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invitations_pending_email_key
  ON invitations ("institutionId", lower(btrim(email)))
  WHERE "acceptedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_class_name_key
  ON subjects ("institutionId", "classId", lower(btrim(name)))
  WHERE "classId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_global_name_key
  ON subjects ("institutionId", lower(btrim(name)))
  WHERE "classId" IS NULL;

CREATE INDEX IF NOT EXISTS memberships_institution_role_revoked_idx
  ON memberships ("institutionId", role, "revokedAt");
CREATE INDEX IF NOT EXISTS memberships_user_revoked_idx
  ON memberships ("userId", "revokedAt");
CREATE INDEX IF NOT EXISTS invitations_institution_email_status_idx
  ON invitations ("institutionId", lower(email), "acceptedAt", "expiresAt");
CREATE INDEX IF NOT EXISTS classes_institution_year_idx
  ON classes ("institutionId", "academicYearId");
CREATE INDEX IF NOT EXISTS classes_institution_teacher_idx
  ON classes ("institutionId", "sectionTeacherId");
CREATE INDEX IF NOT EXISTS classes_institution_group_idx
  ON classes ("institutionId", "classGroupId");
CREATE INDEX IF NOT EXISTS guardians_institution_phone_idx
  ON guardians ("institutionId", phone);
CREATE INDEX IF NOT EXISTS attendance_sessions_institution_date_idx
  ON attendance_sessions ("institutionId", "sessionDate");
CREATE INDEX IF NOT EXISTS leads_institution_stage_followup_idx
  ON leads ("institutionId", stage, "nextFollowupAt");
CREATE INDEX IF NOT EXISTS leads_institution_phone_idx
  ON leads ("institutionId", phone);
CREATE INDEX IF NOT EXISTS messages_institution_status_created_idx
  ON messages ("institutionId", status, "createdAt");
CREATE INDEX IF NOT EXISTS messages_institution_recipient_created_idx
  ON messages ("institutionId", "recipientPhone", "createdAt");
CREATE INDEX IF NOT EXISTS subjects_institution_class_name_idx
  ON subjects ("institutionId", "classId", name);
CREATE INDEX IF NOT EXISTS exams_institution_class_date_idx
  ON exams ("institutionId", "classId", "examDate");
CREATE INDEX IF NOT EXISTS exam_results_institution_student_idx
  ON exam_results ("institutionId", "studentId");
CREATE INDEX IF NOT EXISTS exam_results_institution_subject_idx
  ON exam_results ("institutionId", "subjectId");
CREATE INDEX IF NOT EXISTS timetable_institution_class_day_idx
  ON timetable_slots ("institutionId", "classId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS timetable_teacher_day_idx
  ON timetable_slots ("teacherId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS homework_institution_class_due_idx
  ON homework ("institutionId", "classId", "dueDate");
CREATE INDEX IF NOT EXISTS homework_institution_created_idx
  ON homework ("institutionId", "createdAt");
CREATE INDEX IF NOT EXISTS notices_institution_audience_published_idx
  ON notices ("institutionId", audience, "publishedAt");
CREATE INDEX IF NOT EXISTS notices_institution_class_published_idx
  ON notices ("institutionId", "classId", "publishedAt");
CREATE INDEX IF NOT EXISTS audit_logs_institution_action_created_idx
  ON audit_logs ("institutionId", action, "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notice_reads_studentId_fkey'
  ) THEN
    ALTER TABLE notice_reads
      ADD CONSTRAINT "notice_reads_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES students(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'timetable_slots_subjectId_fkey'
  ) THEN
    ALTER TABLE timetable_slots
      ADD CONSTRAINT "timetable_slots_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES subjects(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'timetable_slots_teacherId_fkey'
  ) THEN
    ALTER TABLE timetable_slots
      ADD CONSTRAINT "timetable_slots_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'homework_subjectId_fkey'
  ) THEN
    ALTER TABLE homework
      ADD CONSTRAINT "homework_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES subjects(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'homework_teacherId_fkey'
  ) THEN
    ALTER TABLE homework
      ADD CONSTRAINT "homework_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notices_authorId_fkey'
  ) THEN
    ALTER TABLE notices
      ADD CONSTRAINT "notices_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notices_classId_fkey'
  ) THEN
    ALTER TABLE notices
      ADD CONSTRAINT "notices_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES classes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_direct_tenant_scope() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'attendance_sessions' AND NOT EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = NEW."classId" AND c."institutionId" = NEW."institutionId"
  ) THEN
    RAISE EXCEPTION 'Attendance session class must belong to the same institution';
  ELSIF TG_TABLE_NAME = 'subjects'
    AND NEW."classId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = NEW."classId" AND c."institutionId" = NEW."institutionId"
    ) THEN
    RAISE EXCEPTION 'Subject class must belong to the same institution';
  ELSIF TG_TABLE_NAME = 'exams'
    AND NEW."classId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = NEW."classId" AND c."institutionId" = NEW."institutionId"
    ) THEN
    RAISE EXCEPTION 'Exam class must belong to the same institution';
  ELSIF TG_TABLE_NAME = 'homework' AND (
    NOT EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = NEW."classId" AND c."institutionId" = NEW."institutionId"
    )
    OR (
      NEW."subjectId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM subjects s
        WHERE s.id = NEW."subjectId"
          AND s."institutionId" = NEW."institutionId"
          AND (s."classId" IS NULL OR s."classId" = NEW."classId")
      )
    )
    OR NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."userId" = NEW."teacherId"
        AND m."institutionId" = NEW."institutionId"
        AND m."revokedAt" IS NULL
        AND m.role IN ('OWNER', 'ADMIN', 'TEACHER')
    )
  ) THEN
    RAISE EXCEPTION 'Homework references must belong to the same institution and class';
  ELSIF TG_TABLE_NAME = 'notices' AND (
    NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."userId" = NEW."authorId"
        AND m."institutionId" = NEW."institutionId"
        AND m."revokedAt" IS NULL
    )
    OR (
      NEW."classId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = NEW."classId" AND c."institutionId" = NEW."institutionId"
      )
    )
    OR (NEW.audience = 'CLASS' AND NEW."classId" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Notice references must belong to the same institution';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_sessions_tenant_scope ON attendance_sessions;
CREATE TRIGGER attendance_sessions_tenant_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "classId"
  ON attendance_sessions FOR EACH ROW EXECUTE FUNCTION enforce_direct_tenant_scope();

DROP TRIGGER IF EXISTS subjects_tenant_scope ON subjects;
CREATE TRIGGER subjects_tenant_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "classId"
  ON subjects FOR EACH ROW EXECUTE FUNCTION enforce_direct_tenant_scope();

DROP TRIGGER IF EXISTS exams_tenant_scope ON exams;
CREATE TRIGGER exams_tenant_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "classId"
  ON exams FOR EACH ROW EXECUTE FUNCTION enforce_direct_tenant_scope();

DROP TRIGGER IF EXISTS homework_tenant_scope ON homework;
CREATE TRIGGER homework_tenant_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "classId", "subjectId", "teacherId"
  ON homework FOR EACH ROW EXECUTE FUNCTION enforce_direct_tenant_scope();

DROP TRIGGER IF EXISTS notices_tenant_scope ON notices;
CREATE TRIGGER notices_tenant_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "authorId", "classId", audience
  ON notices FOR EACH ROW EXECUTE FUNCTION enforce_direct_tenant_scope();

CREATE OR REPLACE FUNCTION enforce_student_class_scope() RETURNS trigger AS $$
BEGIN
  IF NEW."classId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = NEW."classId"
      AND c."institutionId" = NEW."institutionId"
  ) THEN
    RAISE EXCEPTION 'Student class must belong to the same institution';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_class_scope ON students;
CREATE TRIGGER students_class_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "classId"
  ON students FOR EACH ROW EXECUTE FUNCTION enforce_student_class_scope();

CREATE OR REPLACE FUNCTION enforce_student_guardian_scope() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM students s
    JOIN guardians g ON g.id = NEW."guardianId"
    WHERE s.id = NEW."studentId"
      AND s."institutionId" = g."institutionId"
  ) THEN
    RAISE EXCEPTION 'Student and guardian must belong to the same institution';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_guardians_tenant_scope ON student_guardians;
CREATE TRIGGER student_guardians_tenant_scope
  BEFORE INSERT OR UPDATE OF "studentId", "guardianId"
  ON student_guardians FOR EACH ROW EXECUTE FUNCTION enforce_student_guardian_scope();

CREATE OR REPLACE FUNCTION enforce_attendance_scope() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM attendance_sessions a
    JOIN students s ON s.id = NEW."studentId"
    WHERE a.id = NEW."sessionId"
      AND a."institutionId" = s."institutionId"
      AND a."classId" = s."classId"
  ) THEN
    RAISE EXCEPTION 'Attendance student must belong to the session class and institution';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_records_tenant_scope ON attendance_records;
CREATE TRIGGER attendance_records_tenant_scope
  BEFORE INSERT OR UPDATE OF "sessionId", "studentId"
  ON attendance_records FOR EACH ROW EXECUTE FUNCTION enforce_attendance_scope();

CREATE OR REPLACE FUNCTION enforce_exam_result_scope() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM exams e
    JOIN students s ON s.id = NEW."studentId"
    JOIN subjects sub ON sub.id = NEW."subjectId"
    WHERE e.id = NEW."examId"
      AND e."institutionId" = NEW."institutionId"
      AND s."institutionId" = NEW."institutionId"
      AND sub."institutionId" = NEW."institutionId"
      AND (e."classId" IS NULL OR s."classId" = e."classId")
      AND (sub."classId" IS NULL OR sub."classId" = e."classId")
  ) THEN
    RAISE EXCEPTION 'Exam result references must share tenant and class scope';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exam_results_tenant_scope ON exam_results;
CREATE TRIGGER exam_results_tenant_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "examId", "studentId", "subjectId"
  ON exam_results FOR EACH ROW EXECUTE FUNCTION enforce_exam_result_scope();

CREATE OR REPLACE FUNCTION enforce_timetable_scope_and_collision() RETURNS trigger AS $$
BEGIN
  IF NEW."dayOfWeek" < 1 OR NEW."dayOfWeek" > 7
     OR NEW."startTime" !~ '^[0-2][0-9]:[0-5][0-9]$'
     OR NEW."endTime" !~ '^[0-2][0-9]:[0-5][0-9]$'
     OR NEW."startTime" >= NEW."endTime" THEN
    RAISE EXCEPTION 'Invalid timetable day or time range';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = NEW."classId" AND c."institutionId" = NEW."institutionId"
  ) OR (
    NEW."subjectId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM subjects s
      WHERE s.id = NEW."subjectId"
        AND s."institutionId" = NEW."institutionId"
        AND (s."classId" IS NULL OR s."classId" = NEW."classId")
    )
  ) OR (
    NEW."teacherId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m."userId" = NEW."teacherId"
        AND m."institutionId" = NEW."institutionId"
        AND m."revokedAt" IS NULL
        AND m.role IN ('OWNER', 'ADMIN', 'TEACHER')
    )
  ) THEN
    RAISE EXCEPTION 'Timetable references must belong to the same institution';
  END IF;

  IF EXISTS (
    SELECT 1 FROM timetable_slots t
    WHERE t.id <> NEW.id
      AND t."dayOfWeek" = NEW."dayOfWeek"
      AND (t."classId" = NEW."classId"
        OR (NEW."teacherId" IS NOT NULL AND t."teacherId" = NEW."teacherId"))
      AND NEW."startTime" < t."endTime"
      AND NEW."endTime" > t."startTime"
  ) THEN
    RAISE EXCEPTION 'Timetable slot overlaps an existing class or teacher slot';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timetable_slots_scope_collision ON timetable_slots;
CREATE TRIGGER timetable_slots_scope_collision
  BEFORE INSERT OR UPDATE OF
    "institutionId", "classId", "subjectId", "teacherId",
    "dayOfWeek", "startTime", "endTime"
  ON timetable_slots FOR EACH ROW
  EXECUTE FUNCTION enforce_timetable_scope_and_collision();

CREATE OR REPLACE FUNCTION enforce_class_academic_consistency() RETURNS trigger AS $$
DECLARE
  ay academic_years%ROWTYPE;
  cg class_groups%ROWTYPE;
BEGIN
  IF NEW."academicYearId" IS NULL THEN
    RAISE EXCEPTION 'Academic year relation is required for class';
  END IF;

  SELECT * INTO ay FROM academic_years WHERE id = NEW."academicYearId";
  IF ay.id IS NULL OR ay."institutionId" <> NEW."institutionId" THEN
    RAISE EXCEPTION 'Invalid academic year for class';
  END IF;
  NEW."academicYear" := ay.name;

  IF NEW."classGroupId" IS NOT NULL THEN
    SELECT * INTO cg FROM class_groups WHERE id = NEW."classGroupId";
    IF cg.id IS NULL OR cg."institutionId" <> NEW."institutionId" THEN
      RAISE EXCEPTION 'Invalid class group for class';
    END IF;
    IF NEW."academicYearId" IS NOT NULL
       AND cg."academicYearId" IS DISTINCT FROM NEW."academicYearId" THEN
      RAISE EXCEPTION 'Class group and class academic year do not match';
    END IF;
  END IF;

  IF NEW."sectionTeacherId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m."userId" = NEW."sectionTeacherId"
      AND m."institutionId" = NEW."institutionId"
      AND m."revokedAt" IS NULL
      AND m.role IN ('OWNER', 'ADMIN', 'TEACHER')
  ) THEN
    RAISE EXCEPTION 'Section teacher must be active staff in the institution';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      NEW."sectionLeaderId", NEW."girlsLeaderId", NEW."boysLeaderId"
    ]) leader_id
    WHERE leader_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = leader_id
          AND s."institutionId" = NEW."institutionId"
          AND s."classId" = NEW.id
          AND s.status = 'ACTIVE'
      )
  ) THEN
    RAISE EXCEPTION 'Section leaders must be active students in the class';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS classes_academic_consistency ON classes;
CREATE TRIGGER classes_academic_consistency
  BEFORE INSERT OR UPDATE OF
    "institutionId", "academicYearId", "academicYear", "classGroupId",
    "sectionTeacherId", "sectionLeaderId", "girlsLeaderId", "boysLeaderId"
  ON classes
  FOR EACH ROW EXECUTE FUNCTION enforce_class_academic_consistency();

ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notice_reads_select ON notice_reads;
DROP POLICY IF EXISTS notice_reads_insert ON notice_reads;
CREATE POLICY notice_reads_select ON notice_reads FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM notices n
    JOIN students s ON s.id = notice_reads."studentId"
    WHERE n.id = notice_reads."noticeId"
      AND n."institutionId" = s."institutionId"
      AND is_member(n."institutionId")
  )
);
CREATE POLICY notice_reads_insert ON notice_reads FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM notices n
    JOIN students s ON s.id = notice_reads."studentId"
    WHERE n.id = notice_reads."noticeId"
      AND n."institutionId" = s."institutionId"
      AND (
        has_role(n."institutionId", 'OWNER', 'ADMIN')
        OR (s."classId" IS NOT NULL AND can_access_class(s."classId", n."institutionId"))
      )
  )
);

-- Rollback:
-- 1. Drop Phase 7 triggers and their enforce_* functions.
-- 2. Drop Phase 7 indexes, then the notice-read/timetable foreign keys if they
--    were introduced here.
-- 3. Keep academic-year backfill rows and populated class academicYearId values.
-- 4. Keep notice_reads RLS enabled; restore prior policies only if required.
-- Staging verification:
--   Run pnpm test:data-integrity, pnpm test:migrations, and pnpm test:rls with
--   dedicated test URLs; exercise duplicate/cross-tenant inserts in a rollback
--   transaction and inspect EXPLAIN plans for the documented query set.
-- Production verification:
--   Re-run all audit queries, confirm trigger/index presence, inspect lock and
--   error logs, and verify class/student/attendance/exam/timetable workflows.
