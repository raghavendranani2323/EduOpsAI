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
