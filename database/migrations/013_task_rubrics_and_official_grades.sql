-- EduMaster.ai · CAMBIOS 22 v30.3 · rúbricas y calificación oficial de tareas.
-- Ejecutar UNA vez tras 012. No transforma ni elimina notas, tareas o entregas previas.
-- La puntuación se integra en las notas oficiales existentes, sin duplicar el promedio.
BEGIN;

-- Los criterios pertenecen a la misma tarea y oferta institucional.
CREATE TABLE IF NOT EXISTS app.task_rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  offering_id UUID NOT NULL,
  task_id UUID NOT NULL,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 10),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description)<=500),
  max_points NUMERIC(7,2) NOT NULL CHECK (max_points>0 AND max_points<=100),
  UNIQUE (organization_id,task_id,id),
  UNIQUE (organization_id,task_id,position),
  FOREIGN KEY (organization_id,task_id,offering_id)
    REFERENCES app.course_tasks(organization_id,id,offering_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS task_rubric_by_task_idx ON app.task_rubric_criteria
  (organization_id,task_id,position);

-- La vinculación por matrícula impide crear varias notas para una misma tarea.
-- El registro de academic_activity_records sigue siendo la fuente del promedio.
CREATE UNIQUE INDEX IF NOT EXISTS academic_grade_record_enrollment_scope_idx
  ON app.academic_activity_records(organization_id,id,enrollment_id);
CREATE TABLE IF NOT EXISTS app.task_official_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  offering_id UUID NOT NULL,
  task_id UUID NOT NULL,
  enrollment_id UUID NOT NULL,
  submission_id UUID NOT NULL,
  academic_record_id UUID NOT NULL,
  score NUMERIC(7,2) NOT NULL CHECK (score>=0),
  max_score NUMERIC(7,2) NOT NULL CHECK (max_score>0 AND score<=max_score),
  criteria_scores JSONB NOT NULL CHECK (jsonb_typeof(criteria_scores)='array'),
  feedback TEXT NOT NULL DEFAULT '' CHECK (char_length(feedback)<=3000),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
  graded_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,task_id,enrollment_id),
  UNIQUE (organization_id,academic_record_id),
  FOREIGN KEY (organization_id,task_id,offering_id)
    REFERENCES app.course_tasks(organization_id,id,offering_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,enrollment_id,offering_id)
    REFERENCES app.enrollments(organization_id,id,offering_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,submission_id,task_id,enrollment_id,offering_id)
    REFERENCES app.task_submissions(organization_id,id,task_id,enrollment_id,offering_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,academic_record_id,enrollment_id)
    REFERENCES app.academic_activity_records(organization_id,id,enrollment_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS task_official_grades_by_task_idx ON app.task_official_grades
  (organization_id,task_id,graded_at DESC);

-- Cada rectificación guarda el estado ANTERIOR completo, incluida la rúbrica.
CREATE TABLE IF NOT EXISTS app.task_official_grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  grade_id UUID NOT NULL,
  revision INTEGER NOT NULL CHECK (revision>0),
  previous_score NUMERIC(7,2) NOT NULL,
  previous_max_score NUMERIC(7,2) NOT NULL,
  previous_criteria_scores JSONB NOT NULL,
  previous_feedback TEXT NOT NULL,
  changed_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,grade_id,revision),
  FOREIGN KEY (organization_id,grade_id)
    REFERENCES app.task_official_grades(organization_id,id) ON DELETE RESTRICT
);

-- Los cuatro conjuntos son accesibles SOLO mediante FastAPI y permisos por tenant.
ALTER TABLE app.task_rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.task_rubric_criteria FORCE ROW LEVEL SECURITY;
ALTER TABLE app.task_official_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.task_official_grades FORCE ROW LEVEL SECURITY;
ALTER TABLE app.task_official_grade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.task_official_grade_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.task_rubric_criteria, app.task_official_grades,
  app.task_official_grade_history FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON app.task_rubric_criteria, app.task_official_grades,
      app.task_official_grade_history FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON app.task_rubric_criteria, app.task_official_grades,
      app.task_official_grade_history FROM authenticated;
  END IF;
END $$;
COMMIT;
