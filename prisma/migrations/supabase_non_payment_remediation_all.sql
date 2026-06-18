-- EduOps consolidated non-payment remediation for Supabase
-- Generated from the ordered phase SQL files. Safe to rerun after a backup.
-- Prerequisite: the base EduOps schema (through phase 3) already exists.
-- Payment integration tables and payment remediation are intentionally unchanged.
--
-- Supabase SQL Editor: run this entire file as one script.
-- The transaction makes the combined migration atomic. The transaction-scoped
-- advisory lock prevents two operators applying it concurrently.

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('eduops_non_payment_remediation'));

-- BEGIN prisma/migrations/phase4_attendance_integrity.sql
-- Phase 4 security: attendance tenant/class integrity.
-- Rollback: drop these policies and recreate the previous att_sess_insert,
-- att_rec_insert, att_rec_update policies from prisma/policies/rls.sql at the
-- previous commit; drop att_rec_delete if replacement is no longer required.

DROP POLICY IF EXISTS att_sess_insert ON attendance_sessions;
CREATE POLICY att_sess_insert ON attendance_sessions FOR INSERT WITH CHECK (
  has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')
  AND EXISTS (
    SELECT 1
    FROM classes c
    WHERE c.id = attendance_sessions."classId"
      AND c."institutionId" = attendance_sessions."institutionId"
  )
);

DROP POLICY IF EXISTS att_sess_update ON attendance_sessions;
CREATE POLICY att_sess_update ON attendance_sessions FOR UPDATE
  USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'))
  WITH CHECK (
    has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')
    AND EXISTS (
      SELECT 1
      FROM classes c
      WHERE c.id = attendance_sessions."classId"
        AND c."institutionId" = attendance_sessions."institutionId"
    )
  );

DROP POLICY IF EXISTS att_rec_insert ON attendance_records;
CREATE POLICY att_rec_insert ON attendance_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM attendance_sessions s
    JOIN students st ON st.id = attendance_records."studentId"
    WHERE s.id = attendance_records."sessionId"
      AND st."institutionId" = s."institutionId"
      AND st."classId" = s."classId"
      AND st.status = 'ACTIVE'
      AND has_role(s."institutionId", 'OWNER', 'ADMIN', 'TEACHER')
  ));

DROP POLICY IF EXISTS att_rec_update ON attendance_records;
CREATE POLICY att_rec_update ON attendance_records FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM attendance_sessions s
    WHERE s.id = attendance_records."sessionId"
      AND has_role(s."institutionId", 'OWNER', 'ADMIN', 'TEACHER')
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM attendance_sessions s
    JOIN students st ON st.id = attendance_records."studentId"
    WHERE s.id = attendance_records."sessionId"
      AND st."institutionId" = s."institutionId"
      AND st."classId" = s."classId"
      AND st.status = 'ACTIVE'
      AND has_role(s."institutionId", 'OWNER', 'ADMIN', 'TEACHER')
  ));

DROP POLICY IF EXISTS att_rec_delete ON attendance_records;
CREATE POLICY att_rec_delete ON attendance_records FOR DELETE
  USING (EXISTS (
    SELECT 1
    FROM attendance_sessions s
    WHERE s.id = attendance_records."sessionId"
      AND has_role(s."institutionId", 'OWNER', 'ADMIN', 'TEACHER')
  ));
-- END prisma/migrations/phase4_attendance_integrity.sql


-- BEGIN prisma/migrations/phase4_secure_staff_invitations.sql
-- Preserve non-secret staff profile details until a secure invitation is accepted.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS qualification TEXT;

-- Rollback:
-- ALTER TABLE invitations
--   DROP COLUMN IF EXISTS qualification,
--   DROP COLUMN IF EXISTS designation,
--   DROP COLUMN IF EXISTS phone,
--   DROP COLUMN IF EXISTS "fullName";
-- END prisma/migrations/phase4_secure_staff_invitations.sql


-- BEGIN prisma/migrations/phase5_api_foundations.sql
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
-- END prisma/migrations/phase5_api_foundations.sql


-- BEGIN prisma/migrations/phase6_permission_hardening.sql
-- Align academic RLS with the application permission matrix.
-- Apply after phase4_attendance_integrity.sql.

CREATE OR REPLACE FUNCTION can_access_class(p_class_id text, p_institution_id text) RETURNS boolean AS $$
  SELECT
    has_role(p_institution_id, 'OWNER', 'ADMIN')
    OR EXISTS (
      SELECT 1
      FROM classes c
      LEFT JOIN class_groups cg ON cg.id = c."classGroupId"
      WHERE c.id = p_class_id
        AND c."institutionId" = p_institution_id
        AND (
          c."sectionTeacherId" = current_user_id()
          OR cg."classHeadId" = current_user_id()
        )
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS cls_select ON classes;
CREATE POLICY cls_select ON classes FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT')
  OR can_access_class(id, "institutionId")
);

DROP POLICY IF EXISTS stu_select ON students;
CREATE POLICY stu_select ON students FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT')
  OR ("classId" IS NOT NULL AND can_access_class("classId", "institutionId"))
);

DROP POLICY IF EXISTS att_sess_select ON attendance_sessions;
DROP POLICY IF EXISTS att_sess_insert ON attendance_sessions;
DROP POLICY IF EXISTS att_sess_update ON attendance_sessions;
CREATE POLICY att_sess_select ON attendance_sessions FOR SELECT
  USING (can_access_class("classId", "institutionId"));
CREATE POLICY att_sess_insert ON attendance_sessions FOR INSERT
  WITH CHECK (
    can_access_class("classId", "institutionId")
    AND EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = attendance_sessions."classId"
        AND c."institutionId" = attendance_sessions."institutionId"
    )
  );
CREATE POLICY att_sess_update ON attendance_sessions FOR UPDATE
  USING (can_access_class("classId", "institutionId"))
  WITH CHECK (
    can_access_class("classId", "institutionId")
    AND EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = attendance_sessions."classId"
        AND c."institutionId" = attendance_sessions."institutionId"
    )
  );

DROP POLICY IF EXISTS att_rec_insert ON attendance_records;
DROP POLICY IF EXISTS att_rec_update ON attendance_records;
DROP POLICY IF EXISTS att_rec_delete ON attendance_records;
CREATE POLICY att_rec_insert ON attendance_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM attendance_sessions s
    JOIN students st ON st.id = attendance_records."studentId"
    WHERE s.id = attendance_records."sessionId"
      AND st."institutionId" = s."institutionId"
      AND st."classId" = s."classId"
      AND st.status = 'ACTIVE'
      AND can_access_class(s."classId", s."institutionId")
  ));
CREATE POLICY att_rec_update ON attendance_records FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_records."sessionId"
      AND can_access_class(s."classId", s."institutionId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM attendance_sessions s
    JOIN students st ON st.id = attendance_records."studentId"
    WHERE s.id = attendance_records."sessionId"
      AND st."institutionId" = s."institutionId"
      AND st."classId" = s."classId"
      AND st.status = 'ACTIVE'
      AND can_access_class(s."classId", s."institutionId")
  ));
CREATE POLICY att_rec_delete ON attendance_records FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_records."sessionId"
      AND can_access_class(s."classId", s."institutionId")
  ));

DROP POLICY IF EXISTS subj_sel ON subjects;
DROP POLICY IF EXISTS subj_ins ON subjects;
DROP POLICY IF EXISTS subj_upd ON subjects;
CREATE POLICY subj_sel ON subjects FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN')
  OR ("classId" IS NULL AND has_role("institutionId", 'TEACHER'))
  OR ("classId" IS NOT NULL AND can_access_class("classId", "institutionId"))
);
CREATE POLICY subj_ins ON subjects FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY subj_upd ON subjects FOR UPDATE
  USING (has_role("institutionId", 'OWNER', 'ADMIN'))
  WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

DROP POLICY IF EXISTS exam_sel ON exams;
DROP POLICY IF EXISTS exam_ins ON exams;
DROP POLICY IF EXISTS exam_upd ON exams;
CREATE POLICY exam_sel ON exams FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN')
  OR ("classId" IS NOT NULL AND can_access_class("classId", "institutionId"))
);
CREATE POLICY exam_ins ON exams FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY exam_upd ON exams FOR UPDATE
  USING (has_role("institutionId", 'OWNER', 'ADMIN'))
  WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

DROP POLICY IF EXISTS exres_sel ON exam_results;
DROP POLICY IF EXISTS exres_ins ON exam_results;
DROP POLICY IF EXISTS exres_upd ON exam_results;
CREATE POLICY exres_sel ON exam_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_results."examId"
      AND e."institutionId" = exam_results."institutionId"
      AND e."classId" IS NOT NULL
      AND can_access_class(e."classId", e."institutionId")
  )
);
CREATE POLICY exres_ins ON exam_results FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_results."examId"
      AND e."institutionId" = exam_results."institutionId"
      AND e."classId" IS NOT NULL
      AND can_access_class(e."classId", e."institutionId")
  )
);
CREATE POLICY exres_upd ON exam_results FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_results."examId"
      AND e."institutionId" = exam_results."institutionId"
      AND e."classId" IS NOT NULL
      AND can_access_class(e."classId", e."institutionId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_results."examId"
      AND e."institutionId" = exam_results."institutionId"
      AND e."classId" IS NOT NULL
      AND can_access_class(e."classId", e."institutionId")
  ));

DROP POLICY IF EXISTS tt_sel ON timetable_slots;
CREATE POLICY tt_sel ON timetable_slots FOR SELECT
  USING (can_access_class("classId", "institutionId"));

DROP POLICY IF EXISTS hw_sel ON homework;
DROP POLICY IF EXISTS hw_ins ON homework;
DROP POLICY IF EXISTS hw_upd ON homework;
DROP POLICY IF EXISTS hw_del ON homework;
CREATE POLICY hw_sel ON homework FOR SELECT USING (can_access_class("classId", "institutionId"));
CREATE POLICY hw_ins ON homework FOR INSERT WITH CHECK (can_access_class("classId", "institutionId"));
CREATE POLICY hw_upd ON homework FOR UPDATE
  USING (can_access_class("classId", "institutionId"))
  WITH CHECK (can_access_class("classId", "institutionId"));
CREATE POLICY hw_del ON homework FOR DELETE USING (can_access_class("classId", "institutionId"));

DROP POLICY IF EXISTS nt_sel ON notices;
DROP POLICY IF EXISTS nt_ins ON notices;
DROP POLICY IF EXISTS nt_upd ON notices;
DROP POLICY IF EXISTS nt_del ON notices;
CREATE POLICY nt_sel ON notices FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN')
  OR (
    has_role("institutionId", 'TEACHER')
    AND (
      audience IN ('ALL', 'TEACHERS')
      OR (audience = 'CLASS' AND "classId" IS NOT NULL AND can_access_class("classId", "institutionId"))
    )
  )
);
CREATE POLICY nt_ins ON notices FOR INSERT WITH CHECK (
  has_role("institutionId", 'OWNER', 'ADMIN')
  OR (
    has_role("institutionId", 'TEACHER')
    AND audience = 'CLASS'
    AND "classId" IS NOT NULL
    AND can_access_class("classId", "institutionId")
    AND "authorId" = current_user_id()
  )
);
CREATE POLICY nt_upd ON notices FOR UPDATE
  USING (
    has_role("institutionId", 'OWNER', 'ADMIN')
    OR (
      has_role("institutionId", 'TEACHER')
      AND "authorId" = current_user_id()
      AND audience = 'CLASS'
      AND "classId" IS NOT NULL
      AND can_access_class("classId", "institutionId")
    )
  )
  WITH CHECK (
    has_role("institutionId", 'OWNER', 'ADMIN')
    OR (
      has_role("institutionId", 'TEACHER')
      AND "authorId" = current_user_id()
      AND audience = 'CLASS'
      AND "classId" IS NOT NULL
      AND can_access_class("classId", "institutionId")
    )
  );
CREATE POLICY nt_del ON notices FOR DELETE USING (
  has_role("institutionId", 'OWNER', 'ADMIN')
  OR (
    has_role("institutionId", 'TEACHER')
    AND "authorId" = current_user_id()
    AND audience = 'CLASS'
    AND "classId" IS NOT NULL
    AND can_access_class("classId", "institutionId")
  )
);

-- Rollback: restore policies from the previous rls.sql revision and drop
-- can_access_class only after no policy references it.
-- END prisma/migrations/phase6_permission_hardening.sql


-- BEGIN prisma/migrations/phase7_non_payment_data_integrity.sql
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
-- END prisma/migrations/phase7_non_payment_data_integrity.sql


-- BEGIN prisma/migrations/phase8_admissions_crm.sql
-- Phase 8: focused admissions CRM workflow.
-- Apply after phase7_non_payment_data_integrity.sql.
-- Preconditions: back up staging; confirm all assigned staff IDs are active
-- institution members. This migration does not rewrite or delete lead data.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT,
  ADD COLUMN IF NOT EXISTS "lostReason" TEXT,
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_assignedToId_fkey'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT "leads_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadActivityKind') THEN
    CREATE TYPE "LeadActivityKind" AS ENUM (
      'CREATED', 'NOTE', 'CALL', 'WHATSAPP', 'STAGE_CHANGED',
      'FOLLOWUP_CHANGED', 'OWNER_CHANGED', 'CONVERTED', 'LINKED_EXISTING'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lead_activities (
  id TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "leadId" TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  "actorUserId" TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kind "LeadActivityKind" NOT NULL,
  note TEXT,
  meta JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_institution_owner_followup_idx
  ON leads ("institutionId", "assignedToId", "nextFollowupAt");
CREATE INDEX IF NOT EXISTS lead_activities_lead_created_idx
  ON lead_activities ("institutionId", "leadId", "createdAt");
CREATE INDEX IF NOT EXISTS lead_activities_actor_created_idx
  ON lead_activities ("institutionId", "actorUserId", "createdAt");

CREATE OR REPLACE FUNCTION enforce_lead_owner_scope() RETURNS trigger AS $$
BEGIN
  IF NEW."assignedToId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m."userId" = NEW."assignedToId"
      AND m."institutionId" = NEW."institutionId"
      AND m."revokedAt" IS NULL
      AND m.role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Lead owner must be an active owner or admin in the institution';
  END IF;
  IF NEW.stage = 'LOST' AND COALESCE(btrim(NEW."lostReason"), '') = '' THEN
    RAISE EXCEPTION 'Lost reason is required';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_owner_scope ON leads;
CREATE TRIGGER leads_owner_scope
  BEFORE INSERT OR UPDATE OF "institutionId", "assignedToId", stage, "lostReason"
  ON leads FOR EACH ROW EXECUTE FUNCTION enforce_lead_owner_scope();

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_activity_select ON lead_activities;
DROP POLICY IF EXISTS lead_activity_insert ON lead_activities;
CREATE POLICY lead_activity_select ON lead_activities FOR SELECT
  USING (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY lead_activity_insert ON lead_activities FOR INSERT
  WITH CHECK (
    has_role("institutionId", 'OWNER', 'ADMIN')
    AND "actorUserId" = current_user_id()
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_activities."leadId"
        AND l."institutionId" = lead_activities."institutionId"
    )
  );

-- Rollback:
-- Drop lead_activities, leads_owner_scope/enforce_lead_owner_scope, the owner
-- index/FK, then the three added lead columns. Retain exported activity data.
-- Staging verification: test duplicate warnings, owner tenant scope, required
-- lost reason, activity isolation, conversion conflicts, and rollback.
-- END prisma/migrations/phase8_admissions_crm.sql


-- BEGIN prisma/migrations/phase9_parent_access.sql
-- Phase 9: parent bearer-link lifecycle and audit history.
-- Apply after phase8_admissions_crm.sql.
-- Existing non-null portal tokens receive a 30-day expiry from migration time.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS "portalTokenCreatedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "portalTokenExpiresAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "portalTokenRevokedAt" TIMESTAMPTZ;

UPDATE students
SET
  "portalTokenCreatedAt" = COALESCE("portalTokenCreatedAt", NOW()),
  "portalTokenExpiresAt" = COALESCE("portalTokenExpiresAt", NOW() + INTERVAL '30 days')
WHERE "portalToken" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParentAccessEventAction') THEN
    CREATE TYPE "ParentAccessEventAction" AS ENUM (
      'GENERATED', 'ROTATED', 'REVOKED', 'VIEWED', 'EXPIRED', 'DENIED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS parent_access_events (
  id TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  "actorUserId" TEXT,
  action "ParentAccessEventAction" NOT NULL,
  meta JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS parent_access_events_student_created_idx
  ON parent_access_events ("institutionId", "studentId", "createdAt");

ALTER TABLE parent_access_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_access_events_select ON parent_access_events;
DROP POLICY IF EXISTS parent_access_events_insert ON parent_access_events;
CREATE POLICY parent_access_events_select ON parent_access_events FOR SELECT
  USING (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY parent_access_events_insert ON parent_access_events FOR INSERT
  WITH CHECK (
    has_role("institutionId", 'OWNER', 'ADMIN')
    AND ("actorUserId" IS NULL OR "actorUserId" = current_user_id())
  );

-- Rollback:
-- Drop parent_access_events and its enum, then remove the three lifecycle
-- columns. Revoked/expired tokens must not be re-enabled during rollback.
-- Staging verification: generate, rotate, revoke, expire, invalid-token,
-- sibling-phone, changed-phone, multi-child, and audit-isolation scenarios.
-- END prisma/migrations/phase9_parent_access.sql


-- BEGIN prisma/migrations/phase10_communications_delivery.sql
-- Phase 10: truthful communications delivery lifecycle
--
-- Preconditions:
-- 1. Apply phases 5-9 first.
-- 2. Back up the database and confirm restore access.
-- 3. Configure Meta WhatsApp webhook verification only after this migration.
--
-- Lock/performance:
-- ALTER TABLE takes a short metadata lock. The provider lookup index is built
-- concurrently and therefore this file must not be wrapped in a transaction.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS "providerStatusAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS messages_provider_message_id_idx
  ON messages (provider, "providerMessageId")
  WHERE "providerMessageId" IS NOT NULL;

DROP POLICY IF EXISTS msg_upd ON messages;
CREATE POLICY msg_upd ON messages
  FOR UPDATE
  USING (has_role("institutionId", 'OWNER', 'ADMIN'))
  WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

UPDATE messages
SET
  status = 'FAILED',
  "failedAt" = COALESCE("failedAt", NOW()),
  "providerStatusAt" = COALESCE("providerStatusAt", NOW()),
  "failureReason" = COALESCE("failureReason", 'Legacy console delivery was not verified')
WHERE "providerMessageId" LIKE 'console_%'
  AND status IN ('SENT', 'DELIVERED', 'READ');

-- Rollback:
-- DROP POLICY IF EXISTS msg_upd ON messages;
-- DROP INDEX CONCURRENTLY IF EXISTS messages_provider_message_id_idx;
-- ALTER TABLE messages DROP COLUMN IF EXISTS provider,
--   DROP COLUMN IF EXISTS "providerStatusAt",
--   DROP COLUMN IF EXISTS "deliveredAt",
--   DROP COLUMN IF EXISTS "readAt",
--   DROP COLUMN IF EXISTS "failedAt";
--
-- Staging verification:
-- 1. An unconfigured send returns 503 and creates no message rows.
-- 2. A configured send creates QUEUED rows and stores Meta message IDs.
-- 3. Signed sent/delivered/read/failed webhooks advance status monotonically.
-- 4. Invalid signatures cannot mutate messages.
-- 5. Logs contain counts only, never phone numbers or message bodies.
-- END prisma/migrations/phase10_communications_delivery.sql

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
