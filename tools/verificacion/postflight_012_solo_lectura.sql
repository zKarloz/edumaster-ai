-- CAMBIOS 21 v30.2 · ejecutar DESPUÉS de la migración 012.
-- Solo lectura; las migraciones 009, 010 y 011 no se vuelven a ejecutar.
SELECT
  to_regclass('app.task_submission_files') AS tabla_adjunto,
  (SELECT relrowsecurity FROM pg_class
    WHERE oid='app.task_submission_files'::regclass) AS rls_activada,
  (SELECT relforcerowsecurity FROM pg_class
    WHERE oid='app.task_submission_files'::regclass) AS rls_forzada,
  (SELECT public FROM storage.buckets WHERE id='course-resources') AS bucket_publico,
  (SELECT count(*) FROM app.task_submission_files) AS adjuntos_registrados,
  (SELECT count(*) FROM app.task_submission_files WHERE submission_id IS NULL) AS adjuntos_pendientes,
  (SELECT count(*) FROM app.task_submission_files a
    LEFT JOIN app.task_submissions s
      ON s.organization_id=a.organization_id AND s.id=a.submission_id
      AND s.task_id=a.task_id AND s.offering_id=a.offering_id
      AND s.enrollment_id=a.enrollment_id
    WHERE a.submission_id IS NOT NULL AND s.id IS NULL) AS adjuntos_cruzados,
  (SELECT count(*) FROM app.task_submissions s
    WHERE btrim(s.answer_text) = '' AND NOT EXISTS (
      SELECT 1 FROM app.task_submission_files a
      WHERE a.organization_id=s.organization_id AND a.submission_id=s.id
    )) AS entregas_sin_contenido;
-- Esperado: tabla_adjunto presente, ambas RLS true, bucket_publico false,
-- adjuntos_cruzados = 0, entregas_sin_contenido = 0.
