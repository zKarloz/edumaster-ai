-- EduMaster.ai v16: evidencias reales de actividad académica.
-- EJECUTAR UNA VEZ en Supabase SQL Editor, tras las migraciones 001-004.
-- Idempotente: no elimina instituciones, matrículas, usuarios ni datos previos.
BEGIN;

CREATE TABLE IF NOT EXISTS app.academic_activity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  enrollment_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('grade','attendance','participation')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  activity_date DATE NOT NULL DEFAULT current_date,
  score NUMERIC(7,2),
  max_score NUMERIC(7,2),
  attendance_status TEXT CHECK (attendance_status IN ('present','absent','late','excused')),
  participation_rating SMALLINT CHECK (participation_rating BETWEEN 1 AND 5),
  notes TEXT CHECK (notes IS NULL OR char_length(notes)<=500),
  recorded_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,enrollment_id)
    REFERENCES app.enrollments(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT academic_record_payload CHECK (
    (kind='grade' AND score IS NOT NULL AND max_score>0 AND score>=0 AND score<=max_score
      AND attendance_status IS NULL AND participation_rating IS NULL)
    OR
    (kind='attendance' AND attendance_status IS NOT NULL
      AND score IS NULL AND max_score IS NULL AND participation_rating IS NULL)
    OR
    (kind='participation' AND participation_rating IS NOT NULL
      AND score IS NULL AND max_score IS NULL AND attendance_status IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS academic_activity_by_enrollment_idx
 ON app.academic_activity_records (organization_id,enrollment_id,activity_date DESC)
 WHERE voided_at IS NULL;
-- Evita contar dos veces la misma sesión de asistencia; anular permite corregirla.
CREATE UNIQUE INDEX IF NOT EXISTS academic_attendance_session_uniq
 ON app.academic_activity_records (organization_id,enrollment_id,activity_date,title)
 WHERE kind='attendance' AND voided_at IS NULL;
CREATE INDEX IF NOT EXISTS academic_activity_by_kind_idx
 ON app.academic_activity_records (organization_id,kind,activity_date DESC)
 WHERE voided_at IS NULL;

-- El cliente NUNCA accede directamente al esquema app: FastAPI aplica RBAC y ABAC.
ALTER TABLE app.academic_activity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.academic_activity_records FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   REVOKE ALL ON app.academic_activity_records FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   REVOKE ALL ON app.academic_activity_records FROM authenticated;
 END IF;
END $$;
COMMIT;
