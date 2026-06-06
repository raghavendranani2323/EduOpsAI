-- ============================================================
-- EduOps AI — Row-Level Security Policies
-- Applied after Prisma migrations via a custom migration step.
-- All policies use the sub claim from request.jwt.claims
-- (set by withRls() wrapper) to identify the current user.
-- ============================================================

-- Helper: extract user id from JWT claims set by withRls()
CREATE OR REPLACE FUNCTION current_user_id() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
$$ LANGUAGE sql STABLE;

-- Helper: check if user is an active member of an institution
CREATE OR REPLACE FUNCTION is_member(p_institution_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = current_user_id()
      AND institution_id = p_institution_id
      AND revoked_at IS NULL
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if user has a specific role in an institution
CREATE OR REPLACE FUNCTION has_role(p_institution_id text, VARIADIC p_roles text[]) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = current_user_id()
      AND institution_id = p_institution_id
      AND role = ANY(p_roles)
      AND revoked_at IS NULL
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Enable RLS ──────────────────────────────────────────────
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ── institutions ────────────────────────────────────────────
CREATE POLICY inst_select ON institutions FOR SELECT
  USING (is_member(id));

CREATE POLICY inst_update ON institutions FOR UPDATE
  USING (has_role(id, 'OWNER', 'ADMIN'))
  WITH CHECK (has_role(id, 'OWNER', 'ADMIN'));

-- ── memberships ─────────────────────────────────────────────
CREATE POLICY memb_select ON memberships FOR SELECT
  USING (is_member(institution_id));

CREATE POLICY memb_insert ON memberships FOR INSERT
  WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));

CREATE POLICY memb_update ON memberships FOR UPDATE
  USING (has_role(institution_id, 'OWNER'))
  WITH CHECK (has_role(institution_id, 'OWNER'));

-- ── invitations ─────────────────────────────────────────────
CREATE POLICY inv_select ON invitations FOR SELECT
  USING (is_member(institution_id));

CREATE POLICY inv_insert ON invitations FOR INSERT
  WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));

CREATE POLICY inv_delete ON invitations FOR DELETE
  USING (has_role(institution_id, 'OWNER', 'ADMIN'));

-- ── Generic institution-scoped table macro
-- For: classes, students, guardians, tags, fee_plans, fee_adjustments,
--      invoices, leads, message_templates, messages, attendance_sessions
-- Pattern: members can SELECT; owner/admin can INSERT/UPDATE/DELETE.
-- Attendance INSERT also allowed for TEACHER (for own classes — enforced at app layer).

CREATE POLICY cls_select ON classes FOR SELECT USING (is_member(institution_id));
CREATE POLICY cls_write  ON classes FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY cls_update ON classes FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY cls_delete ON classes FOR DELETE USING (has_role(institution_id, 'OWNER', 'ADMIN'));

CREATE POLICY stu_select ON students FOR SELECT USING (is_member(institution_id));
CREATE POLICY stu_write  ON students FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY stu_update ON students FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY stu_delete ON students FOR DELETE USING (has_role(institution_id, 'OWNER', 'ADMIN'));

CREATE POLICY grd_select ON guardians FOR SELECT USING (is_member(institution_id));
CREATE POLICY grd_write  ON guardians FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY grd_update ON guardians FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));

CREATE POLICY tag_select ON tags FOR SELECT USING (is_member(institution_id));
CREATE POLICY tag_write  ON tags FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY tag_update ON tags FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY tag_delete ON tags FOR DELETE USING (has_role(institution_id, 'OWNER', 'ADMIN'));

CREATE POLICY sg_select ON student_guardians FOR SELECT
  USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND is_member(s.institution_id)));
CREATE POLICY st_select ON student_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND is_member(s.institution_id)));

-- Attendance: members can select; owner/admin/teacher can insert sessions
CREATE POLICY att_sess_select ON attendance_sessions FOR SELECT USING (is_member(institution_id));
CREATE POLICY att_sess_insert ON attendance_sessions FOR INSERT
  WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY att_sess_update ON attendance_sessions FOR UPDATE
  USING (has_role(institution_id, 'OWNER', 'ADMIN', 'TEACHER'))
  WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'TEACHER'));

CREATE POLICY att_rec_select ON attendance_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = session_id AND is_member(s.institution_id)));
CREATE POLICY att_rec_insert ON attendance_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = session_id AND has_role(s.institution_id, 'OWNER', 'ADMIN', 'TEACHER')));
CREATE POLICY att_rec_update ON attendance_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = session_id AND has_role(s.institution_id, 'OWNER', 'ADMIN', 'TEACHER')))
  WITH CHECK (EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.id = session_id AND has_role(s.institution_id, 'OWNER', 'ADMIN', 'TEACHER')));

-- Fee policies
CREATE POLICY fp_select ON fee_plans FOR SELECT USING (is_member(institution_id));
CREATE POLICY fp_write  ON fee_plans FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT'));
CREATE POLICY fp_update ON fee_plans FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT'));

CREATE POLICY fadj_select ON fee_adjustments FOR SELECT USING (is_member(institution_id));
CREATE POLICY fadj_write  ON fee_adjustments FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT'));

CREATE POLICY inv_sel ON invoices FOR SELECT USING (is_member(institution_id));
CREATE POLICY inv_ins ON invoices FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT'));
CREATE POLICY inv_upd ON invoices FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT'));

CREATE POLICY pay_sel ON payments FOR SELECT USING (is_member(institution_id));
CREATE POLICY pay_ins ON payments FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN', 'ACCOUNTANT'));

-- Admissions
CREATE POLICY lead_sel ON leads FOR SELECT USING (is_member(institution_id));
CREATE POLICY lead_ins ON leads FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY lead_upd ON leads FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY lead_del ON leads FOR DELETE USING (has_role(institution_id, 'OWNER', 'ADMIN'));

-- Communications
CREATE POLICY tmpl_sel ON message_templates FOR SELECT USING (is_member(institution_id));
CREATE POLICY tmpl_ins ON message_templates FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
CREATE POLICY tmpl_upd ON message_templates FOR UPDATE USING (has_role(institution_id, 'OWNER', 'ADMIN')) WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));

CREATE POLICY msg_sel ON messages FOR SELECT USING (is_member(institution_id));
CREATE POLICY msg_ins ON messages FOR INSERT WITH CHECK (has_role(institution_id, 'OWNER', 'ADMIN'));
