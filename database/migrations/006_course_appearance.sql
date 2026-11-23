-- EduMaster.ai v21: personalización institucional de la presentación de cursos.
-- Ejecutar ANTES de publicar la API v21. No altera los datos académicos existentes.
-- Los valores son identificadores de una paleta controlada, no HTML ni CSS arbitrario.

ALTER TABLE app.courses
  ADD COLUMN IF NOT EXISTS appearance_icon TEXT NOT NULL DEFAULT 'book-open',
  ADD COLUMN IF NOT EXISTS appearance_color TEXT NOT NULL DEFAULT 'blue';

ALTER TABLE app.course_offerings
  ADD COLUMN IF NOT EXISTS appearance_icon_override TEXT,
  ADD COLUMN IF NOT EXISTS appearance_color_override TEXT;

-- Las restricciones protegen también escrituras externas al API.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='edumaster_course_icon_allowed') THEN
    ALTER TABLE app.courses ADD CONSTRAINT edumaster_course_icon_allowed
    CHECK (appearance_icon IN ('book-open','calculator','code-2','atom','flask-conical','languages','earth','landmark','palette','music','heart-pulse','chart-no-axes-column-increasing'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='edumaster_course_color_allowed') THEN
    ALTER TABLE app.courses ADD CONSTRAINT edumaster_course_color_allowed
    CHECK (appearance_color IN ('blue','teal','purple','amber','rose','indigo','green','slate','orange','cyan'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='edumaster_offering_icon_allowed') THEN
    ALTER TABLE app.course_offerings ADD CONSTRAINT edumaster_offering_icon_allowed
    CHECK (appearance_icon_override IS NULL OR appearance_icon_override IN
      ('book-open','calculator','code-2','atom','flask-conical','languages','earth','landmark','palette','music','heart-pulse','chart-no-axes-column-increasing'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='edumaster_offering_color_allowed') THEN
    ALTER TABLE app.course_offerings ADD CONSTRAINT edumaster_offering_color_allowed
    CHECK (appearance_color_override IS NULL OR appearance_color_override IN
      ('blue','teal','purple','amber','rose','indigo','green','slate','orange','cyan'));
  END IF;
END $$;

-- El esquema app ya usa RLS y FORCE RLS. La migración no agrega políticas públicas
-- ni concede a anon/authenticated acceso directo a las nuevas columnas.
