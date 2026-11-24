-- EduMaster.ai · CAMBIOS 21 v30.1 · tareas por oferta y entregas de texto.
-- Ejecutar UNA vez después de 010. No altera las evaluaciones previas ni notas oficiales.
BEGIN;

CREATE TABLE IF NOT EXISTS app.course_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  offering_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 180),
  instructions TEXT NOT NULL CHECK (char_length(btrim(instructions)) BETWEEN 10 AND 10000),
  due_at TIMESTAMPTZ,
  max_attempts SMALLINT NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,id,offering_id),
  FOREIGN KEY (organization_id,offering_id) REFERENCES app.course_offerings(organization_id,id) ON DELETE RESTRICT,
  CONSTRAINT tasks_published_stamp CHECK ((status='draft' AND published_at IS NULL) OR (status<>'draft' AND published_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS course_tasks_by_offering_idx ON app.course_tasks
  (organization_id,offering_id,status,created_at DESC);

-- Una misma matrícula y tarea pertenecen a la MISMA oferta, por FKs compuestas.
-- Se crea índice único sin cambiar los IDs ni las filas existentes.
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_task_scope_idx ON app.enrollments
  (organization_id,id,offering_id);
CREATE TABLE IF NOT EXISTS app.task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  offering_id UUID NOT NULL,
  task_id UUID NOT NULL,
  enrollment_id UUID NOT NULL,
  attempt_number SMALLINT NOT NULL CHECK (attempt_number BETWEEN 1 AND 10),
  answer_text TEXT NOT NULL CHECK (char_length(btrim(answer_text)) BETWEEN 1 AND 10000),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewed')),
  review_notes TEXT CHECK (review_notes IS NULL OR char_length(btrim(review_notes)) BETWEEN 2 AND 3000),
  reviewed_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,task_id,enrollment_id,attempt_number),
  FOREIGN KEY (organization_id,task_id,offering_id)
    REFERENCES app.course_tasks(organization_id,id,offering_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,enrollment_id,offering_id)
    REFERENCES app.enrollments(organization_id,id,offering_id) ON DELETE RESTRICT,
  CONSTRAINT task_review_consistency CHECK (
    (status='submitted' AND review_notes IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status='reviewed' AND review_notes IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS task_submissions_editor_idx ON app.task_submissions
  (organization_id,task_id,submitted_at DESC);
CREATE INDEX IF NOT EXISTS task_submissions_student_idx ON app.task_submissions
  (organization_id,enrollment_id,submitted_at DESC);

-- Exclusivamente FastAPI accede al esquema app; sin exposición PostgREST.
ALTER TABLE app.course_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.course_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE app.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.task_submissions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON app.course_tasks, app.task_submissions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON app.course_tasks, app.task_submissions FROM authenticated;
  END IF;
END $$;
COMMIT;
