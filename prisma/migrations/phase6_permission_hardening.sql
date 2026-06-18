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
