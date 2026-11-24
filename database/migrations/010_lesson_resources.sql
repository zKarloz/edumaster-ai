-- EduMaster.ai / CAMBIOS 20 v29.2: recursos privados vinculados a revisiones.
-- Aplicar UNA SOLA VEZ, después de 009, con respaldo del esquema app.
-- No modifica el contenido ni la publicación de las lecciones existentes.
BEGIN;

CREATE TABLE app.resource_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'course-resources' CHECK (bucket = 'course-resources'),
    object_path TEXT NOT NULL,
    original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 180),
    media_type TEXT NOT NULL CHECK (media_type IN ('application/pdf','image/png','image/jpeg','image/webp')),
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    uploaded_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, id),
    UNIQUE (bucket, object_path),
    FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE RESTRICT
);

CREATE TABLE app.lesson_revision_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    lesson_revision_id UUID NOT NULL,
    resource_kind TEXT NOT NULL CHECK (resource_kind IN ('file','link')),
    file_id UUID,
    external_url TEXT,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
    position INTEGER NOT NULL CHECK (position > 0),
    added_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, lesson_revision_id, position),
    FOREIGN KEY (organization_id, lesson_revision_id)
        REFERENCES app.lesson_revisions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, file_id)
        REFERENCES app.resource_files(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT lesson_revision_resources_kind_ck CHECK (
        (resource_kind='file' AND file_id IS NOT NULL AND external_url IS NULL)
        OR (resource_kind='link' AND file_id IS NULL AND external_url IS NOT NULL)
    )
);
CREATE INDEX lesson_revision_resources_revision_idx
    ON app.lesson_revision_resources(organization_id, lesson_revision_id, position);
CREATE INDEX lesson_revision_resources_file_idx
    ON app.lesson_revision_resources(organization_id, file_id)
    WHERE file_id IS NOT NULL;

-- Sin políticas para anon/authenticated: únicamente FastAPI valida RBAC/ABAC
-- antes de utilizar su conexión privada PostgreSQL.
ALTER TABLE app.resource_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.resource_files FORCE ROW LEVEL SECURITY;
ALTER TABLE app.lesson_revision_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lesson_revision_resources FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.resource_files, app.lesson_revision_resources FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON app.resource_files, app.lesson_revision_resources FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON app.resource_files, app.lesson_revision_resources FROM authenticated;
  END IF;
END $$;

-- Bucket privado y restringido. Si ya existe, se conserva su configuración;
-- una comprobación posterior impide usarlo si fue configurado como público.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('course-resources', 'course-resources', FALSE, 10485760,
        ARRAY['application/pdf','image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='course-resources' AND public) THEN
    RAISE EXCEPTION 'El bucket course-resources ya existe y es público; revisa la configuración';
  END IF;
END $$;

COMMIT;
