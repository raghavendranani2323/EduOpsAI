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
CREATE POLICY cls_select ON classes FOR SELECT USING (is_member("institutionId"));
CREATE POLICY cls_insert ON classes FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY cls_update ON classes FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY cls_delete ON classes FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── students ────────────────────────────────────────────────
CREATE POLICY stu_select ON students FOR SELECT USING (is_member("institutionId"));
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
CREATE POLICY att_sess_select ON attendance_sessions FOR SELECT USING (is_member("institutionId"));
CREATE POLICY att_sess_insert ON attendance_sessions FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY att_sess_update ON attendance_sessions FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));

CREATE POLICY att_rec_select ON attendance_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = "sessionId" AND is_member(s."institutionId")));
CREATE POLICY att_rec_insert ON attendance_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = "sessionId" AND has_role(s."institutionId", 'OWNER', 'ADMIN', 'TEACHER')));
CREATE POLICY att_rec_update ON attendance_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = "sessionId" AND has_role(s."institutionId", 'OWNER', 'ADMIN', 'TEACHER')))
  WITH CHECK (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = "sessionId" AND has_role(s."institutionId", 'OWNER', 'ADMIN', 'TEACHER')));

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

-- ── profiles (no institution scope — users see their own) ───
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY prof_select ON profiles FOR SELECT USING (id = current_user_id() OR EXISTS (
  SELECT 1 FROM memberships m1, memberships m2
  WHERE m1."userId" = current_user_id() AND m2."userId" = profiles.id AND m1."institutionId" = m2."institutionId"
    AND m1."revokedAt" IS NULL AND m2."revokedAt" IS NULL
));
CREATE POLICY prof_update ON profiles FOR UPDATE USING (id = current_user_id()) WITH CHECK (id = current_user_id());
