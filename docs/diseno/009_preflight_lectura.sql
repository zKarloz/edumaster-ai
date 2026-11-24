-- SOLO LECTURA. Ejecutar y conservar resultados ANTES de migración 009.
-- Número y estado de las lecciones actuales, por institución y procedencia.
SELECT 'institutional' AS source, organization_id, status, count(*) AS lessons
FROM app.lessons GROUP BY organization_id, status
UNION ALL
SELECT 'offering' AS source, organization_id, status, count(*) AS lessons
FROM app.offering_lessons GROUP BY organization_id, status
ORDER BY source, organization_id, status;

-- Preparación para backfill: tamaño de texto y títulos vacíos, sin exponer contenido.
SELECT 'institutional' AS source, COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE trim(title) = '') AS empty_titles,
       MAX(octet_length(COALESCE(content, ''))) AS max_content_bytes
FROM app.lessons
UNION ALL
SELECT 'offering', COUNT(*), COUNT(*) FILTER (WHERE trim(title) = ''),
       MAX(octet_length(COALESCE(content, '')))
FROM app.offering_lessons;

-- Confirmar el rol conectado; los privilegios no se infieren de RLS por sí solos.
SELECT current_user AS postgres_user, session_user AS connected_session_user;

-- Este resultado corresponde al usuario del SQL Editor, NO necesariamente al
-- rol DATABASE_URL utilizado por FastAPI. La API debe ejecutar esta misma
-- comprobación con su propia conexión en un entorno de prueba.
SELECT r.rolname, r.rolbypassrls, r.rolsuper
FROM pg_roles AS r WHERE r.rolname = current_user;

-- Si 009 existe, evitar ejecutar otra vez sin diagnóstico de migraciones.
SELECT to_regclass('app.lesson_revisions') AS existing_revision_table;

-- El backfill distingue NULL de cadena vacía, sin revelar contenidos.
SELECT 'institutional' AS source, COUNT(*) FILTER (WHERE content IS NULL) AS null_bodies
FROM app.lessons
UNION ALL
SELECT 'offering', COUNT(*) FILTER (WHERE content IS NULL)
FROM app.offering_lessons;
