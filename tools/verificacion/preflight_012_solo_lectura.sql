-- CAMBIOS 21 v30.2 · ejecutar ANTES de la migración 012.
-- Consulta de solo lectura, sin alterar objetos ni permisos.
SELECT
  to_regclass('app.course_tasks') AS tabla_tareas,
  to_regclass('app.task_submissions') AS tabla_entregas,
  to_regclass('app.resource_files') AS tabla_archivos_privados,
  to_regclass('app.task_submission_files') AS tabla_nueva_antes,
  (SELECT public FROM storage.buckets WHERE id='course-resources') AS bucket_publico,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='app.task_submissions'::regclass
      AND conname='task_submissions_answer_text_check'
  ) AS restriccion_anterior_presente,
  (SELECT count(*) FROM app.task_submissions) AS entregas_existentes;
-- Esperado: 3 tablas previas, tabla_nueva_antes NULL, bucket_publico false,
-- restriccion_anterior_presente true. No continuar si difiere.
