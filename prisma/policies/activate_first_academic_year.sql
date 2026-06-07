-- Backfill: for every institution that has academic_years but none marked active,
-- activate the most recent one (highest name string).
DO $$
DECLARE
  inst RECORD;
  target_id TEXT;
BEGIN
  FOR inst IN
    SELECT id FROM institutions i
    WHERE EXISTS (SELECT 1 FROM academic_years y WHERE y."institutionId" = i.id)
      AND NOT EXISTS (SELECT 1 FROM academic_years y WHERE y."institutionId" = i.id AND y."isActive" = TRUE)
  LOOP
    SELECT id INTO target_id
    FROM academic_years
    WHERE "institutionId" = inst.id
    ORDER BY name DESC
    LIMIT 1;
    IF target_id IS NOT NULL THEN
      UPDATE academic_years SET "isActive" = TRUE WHERE id = target_id;
    END IF;
  END LOOP;
END $$;

-- For institutions with NO academic years at all, create one using a default name.
-- (The TypeScript helper picks a smarter IST-aware name, but this catches truly empty cases.)
INSERT INTO academic_years (id, "institutionId", name, "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  i.id,
  CASE WHEN EXTRACT(MONTH FROM now() AT TIME ZONE 'Asia/Kolkata') >= 4
       THEN EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Kolkata') || '-' || RIGHT((EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Kolkata') + 1)::text, 2)
       ELSE (EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Kolkata') - 1) || '-' || RIGHT(EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Kolkata')::text, 2)
  END,
  TRUE,
  NOW(),
  NOW()
FROM institutions i
WHERE NOT EXISTS (SELECT 1 FROM academic_years y WHERE y."institutionId" = i.id);

-- Sanity: ensure no institution has more than one active year (last write wins, lowest id stays).
WITH ranked AS (
  SELECT id, "institutionId",
         ROW_NUMBER() OVER (PARTITION BY "institutionId" ORDER BY id) AS rn
  FROM academic_years
  WHERE "isActive" = TRUE
)
UPDATE academic_years a SET "isActive" = FALSE
FROM ranked
WHERE a.id = ranked.id AND ranked.rn > 1;
