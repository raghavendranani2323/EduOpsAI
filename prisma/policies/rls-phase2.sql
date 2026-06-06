-- ============================================================
-- EduOps AI — Phase 2 RLS Policies (idempotent)
-- Apply once after rls.sql has been applied.
-- ============================================================

-- ── PHASE 2 — subjects / exams / exam_results ──────────────
ALTER TABLE subjects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subj_sel ON subjects;
DROP POLICY IF EXISTS subj_ins ON subjects;
DROP POLICY IF EXISTS subj_upd ON subjects;
DROP POLICY IF EXISTS subj_del ON subjects;
CREATE POLICY subj_sel ON subjects FOR SELECT USING (is_member("institutionId"));
CREATE POLICY subj_ins ON subjects FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY subj_upd ON subjects FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY subj_del ON subjects FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

DROP POLICY IF EXISTS exam_sel ON exams;
DROP POLICY IF EXISTS exam_ins ON exams;
DROP POLICY IF EXISTS exam_upd ON exams;
DROP POLICY IF EXISTS exam_del ON exams;
CREATE POLICY exam_sel ON exams FOR SELECT USING (is_member("institutionId"));
CREATE POLICY exam_ins ON exams FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY exam_upd ON exams FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY exam_del ON exams FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

DROP POLICY IF EXISTS exres_sel ON exam_results;
DROP POLICY IF EXISTS exres_ins ON exam_results;
DROP POLICY IF EXISTS exres_upd ON exam_results;
CREATE POLICY exres_sel ON exam_results FOR SELECT USING (is_member("institutionId"));
CREATE POLICY exres_ins ON exam_results FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY exres_upd ON exam_results FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));

-- ── PHASE 2 — timetable ─────────────────────────────────────
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tt_sel ON timetable_slots;
DROP POLICY IF EXISTS tt_ins ON timetable_slots;
DROP POLICY IF EXISTS tt_upd ON timetable_slots;
DROP POLICY IF EXISTS tt_del ON timetable_slots;
CREATE POLICY tt_sel ON timetable_slots FOR SELECT USING (is_member("institutionId"));
CREATE POLICY tt_ins ON timetable_slots FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY tt_upd ON timetable_slots FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
CREATE POLICY tt_del ON timetable_slots FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── PHASE 2 — homework ──────────────────────────────────────
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hw_sel ON homework;
DROP POLICY IF EXISTS hw_ins ON homework;
DROP POLICY IF EXISTS hw_upd ON homework;
DROP POLICY IF EXISTS hw_del ON homework;
CREATE POLICY hw_sel ON homework FOR SELECT USING (is_member("institutionId"));
CREATE POLICY hw_ins ON homework FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY hw_upd ON homework FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY hw_del ON homework FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));

-- ── PHASE 2 — notices ───────────────────────────────────────
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nt_sel ON notices;
DROP POLICY IF EXISTS nt_ins ON notices;
DROP POLICY IF EXISTS nt_upd ON notices;
DROP POLICY IF EXISTS nt_del ON notices;
CREATE POLICY nt_sel ON notices FOR SELECT USING (is_member("institutionId"));
CREATE POLICY nt_ins ON notices FOR INSERT WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY nt_upd ON notices FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN', 'TEACHER'));
CREATE POLICY nt_del ON notices FOR DELETE USING (has_role("institutionId", 'OWNER', 'ADMIN'));

-- ── PHASE 2 — leave_requests ────────────────────────────────
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lv_sel ON leave_requests;
DROP POLICY IF EXISTS lv_ins ON leave_requests;
DROP POLICY IF EXISTS lv_upd ON leave_requests;
CREATE POLICY lv_sel ON leave_requests FOR SELECT USING (is_member("institutionId"));
CREATE POLICY lv_ins ON leave_requests FOR INSERT WITH CHECK (is_member("institutionId"));
CREATE POLICY lv_upd ON leave_requests FOR UPDATE USING (has_role("institutionId", 'OWNER', 'ADMIN')) WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));
