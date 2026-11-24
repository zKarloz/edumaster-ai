-- CAMBIOS 20 v29.2 - solo lectura. Debe devolver
-- bucket_publico=false; tablas RLS activadas/forzadas=true.
SELECT
    (SELECT to_regclass('app.resource_files')::text) AS tabla_archivos,
    (SELECT to_regclass('app.lesson_revision_resources')::text) AS tabla_recursos,
    (SELECT public FROM storage.buckets WHERE id='course-resources') AS bucket_publico,
    (SELECT file_size_limit FROM storage.buckets WHERE id='course-resources') AS limite_bytes,
    (SELECT relrowsecurity FROM pg_class WHERE oid='app.resource_files'::regclass) AS archivos_rls,
    (SELECT relforcerowsecurity FROM pg_class WHERE oid='app.resource_files'::regclass) AS archivos_rls_forzada,
    (SELECT relrowsecurity FROM pg_class WHERE oid='app.lesson_revision_resources'::regclass) AS recursos_rls,
    (SELECT relforcerowsecurity FROM pg_class WHERE oid='app.lesson_revision_resources'::regclass) AS recursos_rls_forzada,
    (SELECT COUNT(*) FROM app.resource_files) AS archivos_registrados,
    (SELECT COUNT(*) FROM app.lesson_revision_resources) AS recursos_registrados;

-- Revisar cuidadosamente si existen políticas genéricas de Storage que
-- podrían conceder acceso a otros buckets (no solo profile-avatars).
SELECT policyname, roles::text, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
ORDER BY policyname;
