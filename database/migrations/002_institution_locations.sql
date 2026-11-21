-- EduMaster.ai / Sprint demo / 002
-- Ejecutar DESPUÉS de 001_initial_schema.sql. No modifica las tablas existentes.
-- Cada institución tiene una ubicación principal, apta para el mapa mundial.
BEGIN;

CREATE TABLE IF NOT EXISTS app.organization_locations (
    organization_id UUID PRIMARY KEY
        REFERENCES app.organizations(id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL
        CHECK (country_code ~ '^[A-Z]{2}$'),
    city VARCHAR(120) NOT NULL CHECK (length(btrim(city)) BETWEEN 2 AND 120),
    address VARCHAR(240),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institution_locations_country_idx
    ON app.organization_locations (country_code, city);

-- La tabla es privada: las lecturas/escrituras pasan exclusivamente por FastAPI.
ALTER TABLE app.organization_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_locations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.organization_locations FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON app.organization_locations FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON app.organization_locations FROM authenticated;
    END IF;
END $$;

-- Reutilizamos la función de marca temporal creada en la migración 001.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'app.organization_locations'::regclass
          AND tgname = 'organization_locations_touch'
    ) THEN
        CREATE TRIGGER organization_locations_touch
        BEFORE UPDATE ON app.organization_locations
        FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
    END IF;
END $$;

COMMENT ON TABLE app.organization_locations IS
  'Ubicación principal de cada institución; visible solo a usuarios autorizados por FastAPI.';

COMMIT;
