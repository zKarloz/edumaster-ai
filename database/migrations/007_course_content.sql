-- EduMaster.ai | v26 — Espacio académico: unidades y lecciones del curso base.
-- Ejecutar UNA vez en Supabase SQL Editor ANTES de desplegar API/frontend.
-- No crea tablas públicas ni relaja RLS. Conserva registros y posiciones existentes.
BEGIN;

ALTER TABLE app.course_modules
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE app.lessons
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Archivado editorial: no borra contenido ni lo expone a estudiantes.
ALTER TABLE app.course_modules DROP CONSTRAINT IF EXISTS course_modules_status_check;
ALTER TABLE app.course_modules ADD CONSTRAINT course_modules_status_check
  CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE app.lessons DROP CONSTRAINT IF EXISTS lessons_status_check;
ALTER TABLE app.lessons ADD CONSTRAINT lessons_status_check
  CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS course_modules_catalog_idx
  ON app.course_modules (organization_id, course_id, position);
CREATE INDEX IF NOT EXISTS lessons_catalog_idx
  ON app.lessons (organization_id, module_id, position);

DROP TRIGGER IF EXISTS course_modules_touch ON app.course_modules;
CREATE TRIGGER course_modules_touch BEFORE UPDATE ON app.course_modules
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS lessons_touch ON app.lessons;
CREATE TRIGGER lessons_touch BEFORE UPDATE ON app.lessons
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- La autorización continúa exclusivamente en FastAPI y los datos residen en app.
ALTER TABLE app.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.course_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE app.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lessons FORCE ROW LEVEL SECURITY;
COMMIT;
