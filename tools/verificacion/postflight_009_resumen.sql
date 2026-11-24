-- CAMBIOS 20 / v29.1 · comprobación única, solo lectura, tras aplicar migración 009.
-- Deben ser cero lecciones sin revisión y cero relaciones cruzadas.
SELECT
  (SELECT count(*) FROM app.lessons) AS lecciones_institucionales,
  (SELECT count(*) FROM app.offering_lessons) AS lecciones_oferta,
  (SELECT count(*) FROM app.lesson_revisions) AS revisiones_totales,
  (SELECT count(*) FROM app.lessons l WHERE NOT EXISTS
     (SELECT 1 FROM app.lesson_revisions r
      WHERE r.organization_id=l.organization_id AND r.institutional_lesson_id=l.id))
    AS institucionales_sin_revision,
  (SELECT count(*) FROM app.offering_lessons l WHERE NOT EXISTS
     (SELECT 1 FROM app.lesson_revisions r
      WHERE r.organization_id=l.organization_id AND r.offering_lesson_id=l.id))
    AS ofertas_sin_revision,
  (SELECT count(*) FROM app.lesson_revisions a JOIN app.lesson_revisions b
     ON b.id=a.base_revision_id AND b.organization_id=a.organization_id
     WHERE a.institutional_lesson_id IS DISTINCT FROM b.institutional_lesson_id
        OR a.offering_lesson_id IS DISTINCT FROM b.offering_lesson_id)
    AS referencias_cruzadas,
  (SELECT relrowsecurity FROM pg_class WHERE oid='app.lesson_revisions'::regclass) AS rls_activada,
  (SELECT relforcerowsecurity FROM pg_class WHERE oid='app.lesson_revisions'::regclass) AS rls_forzada;
