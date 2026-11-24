-- EduMaster.ai · CAMBIOS 21 v30.2 · adjuntos privados en intentos de tareas.
-- Ejecutar una sola vez tras 011. Mantiene las entregas y notas existentes.
BEGIN;

-- Un intento puede contener solo archivos: cadena vacía permitida; el API
-- obliga a que haya texto o al menos un archivo adjunto antes de crearla.
ALTER TABLE app.task_submissions
  DROP CONSTRAINT task_submissions_answer_text_check;
ALTER TABLE app.task_submissions
  ADD CONSTRAINT task_submissions_answer_text_check
  CHECK (char_length(btrim(answer_text)) <= 10000);

-- Garantiza con FK que el adjunto pertenece EXACTAMENTE al intento,
-- matrícula, tarea y oferta de la misma organización.
CREATE UNIQUE INDEX task_submissions_attachment_scope_idx
  ON app.task_submissions(organization_id,id,task_id,enrollment_id,offering_id);

CREATE TABLE app.task_submission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  offering_id UUID NOT NULL,
  task_id UUID NOT NULL,
  enrollment_id UUID NOT NULL,
  submission_id UUID,
  file_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,file_id),
  FOREIGN KEY (organization_id,task_id,offering_id)
    REFERENCES app.course_tasks(organization_id,id,offering_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,enrollment_id,offering_id)
    REFERENCES app.enrollments(organization_id,id,offering_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,file_id)
    REFERENCES app.resource_files(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,submission_id,task_id,enrollment_id,offering_id)
    REFERENCES app.task_submissions(organization_id,id,task_id,enrollment_id,offering_id)
    ON DELETE RESTRICT
);

CREATE INDEX task_submission_files_staged_idx
  ON app.task_submission_files(organization_id,task_id,enrollment_id,created_at)
  WHERE submission_id IS NULL;
CREATE INDEX task_submission_files_submitted_idx
  ON app.task_submission_files(organization_id,submission_id)
  WHERE submission_id IS NOT NULL;

-- Autorización exclusivamente desde FastAPI, con conexión privada.
ALTER TABLE app.task_submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.task_submission_files FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.task_submission_files FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON app.task_submission_files FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON app.task_submission_files FROM authenticated;
  END IF;
END $$;

-- Se reutiliza el bucket privado existente, sin crear ni cambiar políticas
-- públicas de Storage. La API reutiliza la clave de servidor de v29.2.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='course-resources' AND public=FALSE
  ) THEN
    RAISE EXCEPTION 'Se requiere el bucket privado course-resources';
  END IF;
END $$;
COMMIT;
