-- CAMBIOS 21 v30.1 · ejecutar DESPUÉS de 011. Solo lectura.
SELECT
  to_regclass('app.course_tasks')::text AS tabla_tareas,
  to_regclass('app.task_submissions')::text AS tabla_entregas,
  (SELECT relrowsecurity FROM pg_class WHERE oid='app.course_tasks'::regclass) AS tareas_rls,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='app.course_tasks'::regclass) AS tareas_rls_forzada,
  (SELECT relrowsecurity FROM pg_class WHERE oid='app.task_submissions'::regclass) AS entregas_rls,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='app.task_submissions'::regclass) AS entregas_rls_forzada,
  (SELECT count(*) FROM app.course_tasks) AS tareas_registradas,
  (SELECT count(*) FROM app.task_submissions) AS entregas_registradas,
  (SELECT count(*) FROM app.task_submissions s
    LEFT JOIN app.course_tasks t ON t.organization_id=s.organization_id
       AND t.id=s.task_id AND t.offering_id=s.offering_id
    LEFT JOIN app.enrollments e ON e.organization_id=s.organization_id
       AND e.id=s.enrollment_id AND e.offering_id=s.offering_id
    WHERE t.id IS NULL OR e.id IS NULL) AS entregas_sin_alcance;
-- Las cuatro banderas RLS deben ser true y entregas_sin_alcance = 0.
