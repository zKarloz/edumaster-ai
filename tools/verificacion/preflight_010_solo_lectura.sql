-- CAMBIOS 20 v29.2 - consultas exclusivamente de lectura.
SELECT
  to_regclass('app.lesson_revisions')::text AS revisiones_009,
  to_regclass('app.resource_files')::text AS archivos_010_ya_existentes,
  to_regclass('app.lesson_revision_resources')::text AS recursos_010_ya_existentes,
  (SELECT public FROM storage.buckets WHERE id='course-resources') AS bucket_publico_si_existe;
