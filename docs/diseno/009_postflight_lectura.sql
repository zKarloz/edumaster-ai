-- SOLO LECTURA. Ejecutar DESPUÉS de migración 009, en una base de prueba primero.
-- Todos los registros existentes deben tener al menos una revisión inicial.
SELECT 'institutional' AS source, COUNT(*) AS lessons_without_revision
FROM app.lessons l WHERE NOT EXISTS (
    SELECT 1 FROM app.lesson_revisions r
    WHERE r.organization_id=l.organization_id AND r.institutional_lesson_id=l.id
)
UNION ALL
SELECT 'offering', COUNT(*) FROM app.offering_lessons l WHERE NOT EXISTS (
    SELECT 1 FROM app.lesson_revisions r
    WHERE r.organization_id=l.organization_id AND r.offering_lesson_id=l.id
);

-- Conteos por origen y estado; deben corresponder con los registros previos.
SELECT CASE WHEN institutional_lesson_id IS NOT NULL THEN 'institutional' ELSE 'offering' END AS source,
       revision_state, COUNT(*) AS total
FROM app.lesson_revisions
GROUP BY source, revision_state ORDER BY source, revision_state;

-- Restricciones de cardinalidad; todos los valores esperados son cero.
SELECT COUNT(*) AS revisions_with_invalid_parent_count
FROM app.lesson_revisions
WHERE (institutional_lesson_id IS NOT NULL) = (offering_lesson_id IS NOT NULL);

SELECT organization_id, institutional_lesson_id, revision_state, COUNT(*)
FROM app.lesson_revisions
WHERE institutional_lesson_id IS NOT NULL AND revision_state IN ('draft','published')
GROUP BY organization_id, institutional_lesson_id, revision_state HAVING COUNT(*) > 1;

SELECT organization_id, offering_lesson_id, revision_state, COUNT(*)
FROM app.lesson_revisions
WHERE offering_lesson_id IS NOT NULL AND revision_state IN ('draft','published')
GROUP BY organization_id, offering_lesson_id, revision_state HAVING COUNT(*) > 1;

-- RLS debe estar habilitado Y forzado; esto no prueba políticas ni permisos efectivos.
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid='app.lesson_revisions'::regclass;

-- Ninguna revisión debe señalar como base a otra lección del mismo tenant.
SELECT COUNT(*) AS cross_lesson_base_revision_count
FROM app.lesson_revisions child
JOIN app.lesson_revisions base
  ON base.organization_id=child.organization_id AND base.id=child.base_revision_id
WHERE child.institutional_lesson_id IS DISTINCT FROM base.institutional_lesson_id
   OR child.offering_lesson_id IS DISTINCT FROM base.offering_lesson_id;

-- Privilegios del usuario que ejecuta esta consulta. En SQL Editor esto NO
-- acredita los privilegios del rol de FastAPI; repetir desde DATABASE_URL
-- en un entorno de pruebas, sin compartir credenciales ni cambiar permisos.
SELECT current_user AS db_user,
       has_schema_privilege(current_user, 'app', 'USAGE') AS can_use_schema,
       has_table_privilege(current_user, 'app.lesson_revisions', 'SELECT') AS can_read_revisions,
       has_table_privilege(current_user, 'app.lesson_revisions', 'INSERT') AS can_insert_revisions,
       has_table_privilege(current_user, 'app.lesson_revisions', 'UPDATE') AS can_update_revisions;
