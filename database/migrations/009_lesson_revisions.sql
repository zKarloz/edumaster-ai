-- EduMaster.ai · CAMBIOS 20 / v29.1 — ENTREGA v29.1 (ejecutar una sola vez tras respaldo).
-- Requiere migraciones 001..008 y una copia de seguridad verificada.
-- Migración aditiva. No altera las tablas ni el contenido visible de las lecciones.
-- app.lesson_revisions es privada; el acceso de clientes se realiza por FastAPI.
BEGIN;

-- Una instantánea coherente: evitar escrituras concurrentes de la API v28
-- mientras se captura el estado inicial de ambas tablas. Programar en mantenimiento.
LOCK TABLE app.lessons, app.offering_lessons IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE app.lesson_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    institutional_lesson_id UUID,
    offering_lesson_id UUID,
    base_revision_id UUID,
    revision_number INTEGER,
    revision_state TEXT NOT NULL CHECK (revision_state IN ('draft', 'published', 'superseded')),
    document_format TEXT NOT NULL CHECK (document_format IN ('plain-text-v1', 'tiptap-json-v1')),
    document_body TEXT NOT NULL DEFAULT '',
    -- En v28 content permite NULL; conservar la diferencia entre NULL y ''.
    legacy_content_was_null BOOLEAN NOT NULL DEFAULT FALSE,
    title TEXT NOT NULL,
    lock_version INTEGER NOT NULL DEFAULT 1 CHECK (lock_version > 0),
    origin TEXT NOT NULL DEFAULT 'editor' CHECK (origin IN ('legacy', 'editor', 'restored')),
    created_by UUID,
    updated_by UUID,
    published_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    UNIQUE (organization_id, id),
    -- Permiten que el origen de un borrador pertenezca a la MISMA lección.
    UNIQUE (organization_id, institutional_lesson_id, id),
    UNIQUE (organization_id, offering_lesson_id, id),
    FOREIGN KEY (organization_id) REFERENCES app.organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, institutional_lesson_id)
        REFERENCES app.lessons(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, offering_lesson_id)
        REFERENCES app.offering_lessons(organization_id, id) ON DELETE RESTRICT,
    -- FK triples: cuando una lección es institucional aplica la primera;
    -- en una lección de oferta aplica la segunda. MATCH SIMPLE omite
    -- la FK cuyo campo de origen es NULL, sin debilitar la otra.
    FOREIGN KEY (organization_id, institutional_lesson_id, base_revision_id)
        REFERENCES app.lesson_revisions(organization_id, institutional_lesson_id, id)
        ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, offering_lesson_id, base_revision_id)
        REFERENCES app.lesson_revisions(organization_id, offering_lesson_id, id)
        ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES app.users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES app.users(id) ON DELETE SET NULL,
    FOREIGN KEY (published_by) REFERENCES app.users(id) ON DELETE SET NULL,
    CONSTRAINT lesson_revisions_no_self_reference_ck CHECK (
        base_revision_id IS NULL OR base_revision_id <> id
    ),
    CONSTRAINT lesson_revisions_single_parent_ck CHECK (
        (institutional_lesson_id IS NOT NULL) <> (offering_lesson_id IS NOT NULL)
    ),
    CONSTRAINT lesson_revisions_number_ck CHECK (
        (revision_number IS NULL OR revision_number > 0)
        AND (revision_state <> 'published' OR revision_number IS NOT NULL)
        AND (revision_state <> 'draft' OR revision_number IS NULL)
    )
);

-- Se admiten varias revisiones históricas, pero como máximo UN borrador
-- y UNA revisión publicada en cada lección y organización.
CREATE UNIQUE INDEX lesson_revisions_one_base_draft_idx
    ON app.lesson_revisions (organization_id, institutional_lesson_id)
    WHERE institutional_lesson_id IS NOT NULL AND revision_state = 'draft';
CREATE UNIQUE INDEX lesson_revisions_one_offering_draft_idx
    ON app.lesson_revisions (organization_id, offering_lesson_id)
    WHERE offering_lesson_id IS NOT NULL AND revision_state = 'draft';
CREATE UNIQUE INDEX lesson_revisions_one_base_published_idx
    ON app.lesson_revisions (organization_id, institutional_lesson_id)
    WHERE institutional_lesson_id IS NOT NULL AND revision_state = 'published';
CREATE UNIQUE INDEX lesson_revisions_one_offering_published_idx
    ON app.lesson_revisions (organization_id, offering_lesson_id)
    WHERE offering_lesson_id IS NOT NULL AND revision_state = 'published';
CREATE UNIQUE INDEX lesson_revisions_base_number_idx
    ON app.lesson_revisions (organization_id, institutional_lesson_id, revision_number)
    WHERE institutional_lesson_id IS NOT NULL AND revision_number IS NOT NULL;
CREATE UNIQUE INDEX lesson_revisions_offering_number_idx
    ON app.lesson_revisions (organization_id, offering_lesson_id, revision_number)
    WHERE offering_lesson_id IS NOT NULL AND revision_number IS NOT NULL;
CREATE INDEX lesson_revisions_base_history_idx
    ON app.lesson_revisions (organization_id, institutional_lesson_id, created_at DESC);
CREATE INDEX lesson_revisions_offering_history_idx
    ON app.lesson_revisions (organization_id, offering_lesson_id, created_at DESC);

-- Conservamos el texto de v28 y si era NULL en formato plain-text-v1. Transformarlo
-- a documento Tiptap se hace en FastAPI, con validación, al abrir el editor.
-- No inferimos quién publicó las lecciones antiguas ni inventamos fechas.
-- Un número de versión 1 representa el primer punto de control CONOCIDO.
INSERT INTO app.lesson_revisions (
    organization_id, institutional_lesson_id, revision_number, revision_state,
    title, document_format, document_body, legacy_content_was_null,
    origin, created_at, updated_at
)
SELECT l.organization_id, l.id,
       CASE WHEN l.status = 'published' THEN 1 ELSE NULL END,
       CASE l.status WHEN 'archived' THEN 'superseded' ELSE l.status END,
       l.title, 'plain-text-v1', COALESCE(l.content, ''),
       l.content IS NULL, 'legacy', l.created_at, l.updated_at
FROM app.lessons AS l
WHERE NOT EXISTS (
    SELECT 1 FROM app.lesson_revisions r
    WHERE r.organization_id = l.organization_id AND r.institutional_lesson_id = l.id
);

INSERT INTO app.lesson_revisions (
    organization_id, offering_lesson_id, revision_number, revision_state,
    title, document_format, document_body, legacy_content_was_null,
    origin, created_at, updated_at
)
SELECT l.organization_id, l.id,
       CASE WHEN l.status = 'published' THEN 1 ELSE NULL END,
       CASE l.status WHEN 'archived' THEN 'superseded' ELSE l.status END,
       l.title, 'plain-text-v1', COALESCE(l.content, ''),
       l.content IS NULL, 'legacy', l.created_at, l.updated_at
FROM app.offering_lessons AS l
WHERE NOT EXISTS (
    SELECT 1 FROM app.lesson_revisions r
    WHERE r.organization_id = l.organization_id AND r.offering_lesson_id = l.id
);

DROP TRIGGER IF EXISTS lesson_revisions_touch ON app.lesson_revisions;
CREATE TRIGGER lesson_revisions_touch
BEFORE UPDATE ON app.lesson_revisions
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Defensa en profundidad: los clientes Supabase no pueden leer borradores
-- ni escribir revisiones. La API utiliza el rol servidor ya configurado.
ALTER TABLE app.lesson_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lesson_revisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.lesson_revisions FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON app.lesson_revisions FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON app.lesson_revisions FROM authenticated;
    END IF;
END $$;

COMMIT;
