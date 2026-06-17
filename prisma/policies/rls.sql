-- ============================================================
-- EduOps AI — Row-Level Security Policies
-- Column names are quoted camelCase (Prisma default).
-- All policies use sub from request.jwt.claims set by withRls().
-- ============================================================

CREATE OR REPLACE FUNCTION current_user_id() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_member(p_institution_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE "userId" = current_user_id()
      AND "institutionId" = p_institution_id
      AND "revokedAt" IS NULL
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_role(p_institution_id text, VARIADIC p_roles text[]) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE "userId" = current_user_id()
      AND "institutionId" = p_institution_id
      AND role::text = ANY(p_roles)
      AND "revokedAt" IS NULL
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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

-- ── Enable RLS ──────────────────────────────────────────────
ALTER TABLE institutions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians             ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_adjustments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;

-- ── institutions ────────────────────────────────────────────
CREATE POLICY inst_select ON institutions FOR SELECT USING (is_member(id));
CREATE POLICY inst_update ON institutions FOR UPDATE
  USING (has_role(id, 'OWNER', 'ADMIN'))
  WITH CHECK (has_role(id, 'OWNER', 'ADMIN'));

-- ── memberships ─────────────────────────────────────────────
CREATE POLICY memb_select ON memberships FOR SELECT USING (is_member("institutionId"));
CREATE POLICY memb_insert ON memberships FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY memb_update ON memberships FOR UPDATE
  USING (has_role("institutionId", 'OWNER'))
  WITH CHECK (has_role("institutionId", 'OWNER'));

-- ── invitations ─────────────────────────────────────────────
CREATE POLICY inv_select ON invitations FOR SELECT USING (is_member("institutionId"));
CREATE POLICY inv_insert ON invitations FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY inv_delete ON invitations FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── classes ─────────────────────────────────────────────────
CREATE POLICY cls_select ON classes FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT')
  OR can_access_class(id, "institutionId")
);
CREATE POLICY cls_insert ON classes FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY cls_update ON classes FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY cls_delete ON classes FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── students ────────────────────────────────────────────────
CREATE POLICY stu_select ON students FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT')
  OR ("classId" IS NOT NULL AND can_access_class("classId", "institutionId"))
);
CREATE POLICY stu_insert ON students FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY stu_update ON students FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY stu_delete ON students FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── guardians ───────────────────────────────────────────────
CREATE POLICY grd_select ON guardians FOR SELECT USING (is_member("institutionId"));
CREATE POLICY grd_insert ON guardians FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY grd_update ON guardians FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── tags ────────────────────────────────────────────────────
CREATE POLICY tag_select ON tags FOR SELECT USING (is_member("institutionId"));
CREATE POLICY tag_insert ON tags FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY tag_update ON tags FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY tag_delete ON tags FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── student_guardians / student_tags (junction tables) ──────
CREATE POLICY sg_select ON student_guardians FOR SELECT
  USING (EXISTS (SELECT 1 FROM students s WHERE s.id = "studentId" AND is_member(s."institutionId")));
CREATE POLICY sg_insert ON student_guardians FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = "studentId" AND has_role(s."institutionId", 'OWNER', 'ADMIN')));
CREATE POLICY sg_delete ON student_guardians FOR DELETE
  USING (EXISTS (SELECT 1 FROM students s WHERE s.id = "studentId" AND has_role(s."institutionId", 'OWNER', 'ADMIN')));

CREATE POLICY st_select ON student_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM students s WHERE s.id = "studentId" AND is_member(s."institutionId")));
CREATE POLICY st_insert ON student_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = "studentId" AND has_role(s."institutionId", 'OWNER', 'ADMIN')));
CREATE POLICY st_delete ON student_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM students s WHERE s.id = "studentId" AND has_role(s."institutionId", 'OWNER', 'ADMIN')));

-- ── attendance ──────────────────────────────────────────────
CREATE POLICY att_sess_select ON attendance_sessions FOR SELECT USING (
  can_access_class("classId", "institutionId")
);
CREATE POLICY att_sess_insert ON attendance_sessions FOR INSERT WITH CHECK (
  can_access_class(attendance_sessions."classId", "institutionId")
  AND EXISTS (SELECT 1 FROM classes c WHERE c.id = attendance_sessions."classId" AND c."institutionId" = attendance_sessions."institutionId")
);
CREATE POLICY att_sess_update ON attendance_sessions FOR UPDATE
  USING (can_access_class(attendance_sessions."classId", "institutionId"))
  WITH CHECK (
    can_access_class(attendance_sessions."classId", "institutionId")
    AND EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = attendance_sessions."classId"
        AND c."institutionId" = attendance_sessions."institutionId"
    )
  );

CREATE POLICY att_rec_select ON attendance_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = "sessionId" AND is_member(s."institutionId")));
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
  USING (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = "sessionId" AND can_access_class(s."classId", s."institutionId")))
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
  USING (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = attendance_records."sessionId" AND can_access_class(s."classId", s."institutionId")));

-- ── fees ────────────────────────────────────────────────────
CREATE POLICY fp_select ON fee_plans FOR SELECT USING (is_member("institutionId"));
CREATE POLICY fp_insert ON fee_plans FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT'));
CREATE POLICY fp_update ON fee_plans FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT'));

CREATE POLICY fadj_select ON fee_adjustments FOR SELECT USING (is_member("institutionId"));
CREATE POLICY fadj_insert ON fee_adjustments FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT'));

CREATE POLICY inv_sel ON invoices FOR SELECT USING (is_member("institutionId"));
CREATE POLICY inv_ins ON invoices FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT'));
CREATE POLICY inv_upd ON invoices FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT'));

CREATE POLICY pay_sel ON payments FOR SELECT USING (is_member("institutionId"));
CREATE POLICY pay_ins ON payments FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'ACCOUNTANT'));

-- ── admissions ──────────────────────────────────────────────
CREATE POLICY lead_sel ON leads FOR SELECT USING (is_member("institutionId"));
CREATE POLICY lead_ins ON leads FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY lead_upd ON leads FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY lead_del ON leads FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── communications ──────────────────────────────────────────
CREATE POLICY tmpl_sel ON message_templates FOR SELECT USING (is_member("institutionId"));
CREATE POLICY tmpl_ins ON message_templates FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY tmpl_upd ON message_templates FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

CREATE POLICY msg_sel ON messages FOR SELECT USING (is_member("institutionId"));
CREATE POLICY msg_ins ON messages FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── PHASE 2 — subjects / exams / exam_results ──────────────
ALTER TABLE subjects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY subj_sel ON subjects FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN')
  OR ("classId" IS NULL AND has_role("institutionId", 'TEACHER'))
  OR ("classId" IS NOT NULL AND can_access_class("classId", "institutionId"))
);
CREATE POLICY subj_ins ON subjects FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY subj_upd ON subjects FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY subj_del ON subjects FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

CREATE POLICY exam_sel ON exams FOR SELECT USING (
  has_role("institutionId", 'OWNER', 'ADMIN')
  OR ("classId" IS NOT NULL AND can_access_class("classId", "institutionId"))
);
CREATE POLICY exam_ins ON exams FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY exam_upd ON exams FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY exam_del ON exams FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

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

-- ── PHASE 2 — timetable ─────────────────────────────────────
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tt_sel ON timetable_slots FOR SELECT USING (can_access_class("classId", "institutionId"));
CREATE POLICY tt_ins ON timetable_slots FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY tt_upd ON timetable_slots FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY tt_del ON timetable_slots FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── PHASE 2 — homework ──────────────────────────────────────
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY hw_sel ON homework FOR SELECT USING (can_access_class("classId", "institutionId"));
CREATE POLICY hw_ins ON homework FOR INSERT WITH CHECK (can_access_class("classId", "institutionId"));
CREATE POLICY hw_upd ON homework FOR UPDATE USING (can_access_class("classId", "institutionId")) WITH CHECK (can_access_class("classId", "institutionId"));
CREATE POLICY hw_del ON homework FOR DELETE USING (can_access_class("classId", "institutionId"));

-- ── PHASE 2 — notices ───────────────────────────────────────
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
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
DROP POLICY IF EXISTS nt_del ON notices;
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
CREATE POLICY nt_del ON notices FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── PHASE 2 — leave_requests ────────────────────────────────
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY lv_sel ON leave_requests FOR SELECT USING (is_member("institutionId"));
CREATE POLICY lv_ins ON leave_requests FOR INSERT WITH CHECK (is_member("institutionId"));
CREATE POLICY lv_upd ON leave_requests FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── profiles (no institution scope — users see their own) ───
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY prof_select ON profiles FOR SELECT USING (id = current_user_id() OR EXISTS (
  SELECT 1 FROM memberships m1, memberships m2
  WHERE m1."userId" = current_user_id() AND m2."userId" = profiles.id AND m1."institutionId" = m2."institutionId"
    AND m1."revokedAt" IS NULL AND m2."revokedAt" IS NULL
));
CREATE POLICY prof_update ON profiles FOR UPDATE USING (id = current_user_id()) WITH CHECK (id = current_user_id());
