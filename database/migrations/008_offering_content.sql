-- EduMaster.ai · CAMBIOS 18 (v27): contenido propio de ofertas.
-- Ejecutar después de 007 y ANTES del despliegue. Sin modificar unidades institucionales.
BEGIN;

CREATE TABLE IF NOT EXISTS app.offering_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  offering_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 180),
  description TEXT,
  position INT NOT NULL CHECK (position > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,offering_id,position),
  FOREIGN KEY (organization_id,offering_id)
    REFERENCES app.course_offerings(organization_id,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS app.offering_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  module_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 180),
  content TEXT,
  position INT NOT NULL CHECK (position > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,module_id,position),
  FOREIGN KEY (organization_id,module_id)
    REFERENCES app.offering_modules(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS offering_modules_lookup_idx
  ON app.offering_modules (organization_id,offering_id,status,position);
CREATE INDEX IF NOT EXISTS offering_lessons_lookup_idx
  ON app.offering_lessons (organization_id,module_id,status,position);

DROP TRIGGER IF EXISTS offering_modules_touch ON app.offering_modules;
CREATE TRIGGER offering_modules_touch BEFORE UPDATE ON app.offering_modules
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
DROP TRIGGER IF EXISTS offering_lessons_touch ON app.offering_lessons;
CREATE TRIGGER offering_lessons_touch BEFORE UPDATE ON app.offering_lessons
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Sin políticas ni privilegios para los clientes Supabase; solo servicio privado API.
ALTER TABLE app.offering_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.offering_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE app.offering_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.offering_lessons FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.offering_modules, app.offering_lessons FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   REVOKE ALL ON app.offering_modules, app.offering_lessons FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   REVOKE ALL ON app.offering_modules, app.offering_lessons FROM authenticated;
 END IF;
END $$;
COMMIT;
