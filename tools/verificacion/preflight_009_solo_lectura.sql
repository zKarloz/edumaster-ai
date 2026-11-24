-- Comprobación NO DESTRUCTIVA. Apta para SQL Editor de Supabase ANTES de 009.
-- No incluye datos personales ni ningún comando de escritura.
SELECT current_database() AS database_name, current_user AS sql_editor_role,
       current_setting('server_version') AS postgres_version;
SELECT 'app.lessons' AS tabla, status, count(*) AS total
  FROM app.lessons GROUP BY status
UNION ALL
SELECT 'app.offering_lessons', status, count(*)
  FROM app.offering_lessons GROUP BY status
ORDER BY tabla, status;
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activa,
       c.relforcerowsecurity AS rls_forzada
FROM pg_class c
WHERE c.oid IN ('app.lessons'::regclass, 'app.offering_lessons'::regclass)
ORDER BY c.relname;
SELECT to_regclass('app.lesson_revisions') AS tabla_revisiones_ya_existente;
