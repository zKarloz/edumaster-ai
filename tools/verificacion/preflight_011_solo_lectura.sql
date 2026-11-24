-- CAMBIOS 21 v30.1 · ejecutar ANTES de 011, sin alterar datos.
SELECT
  to_regclass('app.course_offerings')::text AS ofertas_base,
  to_regclass('app.enrollments')::text AS matriculas_base,
  to_regclass('app.users')::text AS usuarios_base,
  to_regclass('app.course_tasks')::text AS tareas_antes,
  to_regclass('app.task_submissions')::text AS entregas_antes,
  (SELECT count(*) FROM app.course_offerings) AS ofertas_existentes,
  (SELECT count(*) FROM app.enrollments) AS matriculas_existentes;
-- Si tareas_antes o entregas_antes NO son NULL, detente y revisa antes de repetir migración.
