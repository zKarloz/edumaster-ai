-- Las siguientes comprobaciones fallan con excepción SQL ante un error de la 009.
DO $$
DECLARE
  pub UUID;
  count_revisions INTEGER;
BEGIN
  SELECT count(*) INTO count_revisions FROM app.lesson_revisions;
  IF count_revisions <> 7 THEN
    RAISE EXCEPTION '009: esperaba 7 revisiones migradas, recibí %', count_revisions;
  END IF;
  IF (SELECT count(*) FROM app.lesson_revisions WHERE revision_state='published') <> 3
     OR (SELECT count(*) FROM app.lesson_revisions WHERE revision_state='draft') <> 2
     OR (SELECT count(*) FROM app.lesson_revisions WHERE revision_state='superseded') <> 2 THEN
    RAISE EXCEPTION '009: estados migrados incorrectos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.lesson_revisions
    WHERE institutional_lesson_id='22222222-2222-4222-8222-222222222222'
    AND legacy_content_was_null AND document_body='' AND revision_state='draft') THEN
    RAISE EXCEPTION '009: se perdió la distinción NULL frente a cadena vacía';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.lesson_revisions
    WHERE institutional_lesson_id='33333333-3333-4333-8333-333333333333'
    AND NOT legacy_content_was_null AND document_body='' AND revision_state='superseded') THEN
    RAISE EXCEPTION '009: se perdió contenido vacío archivado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.lesson_revisions
    WHERE institutional_lesson_id='11111111-1111-4111-8111-111111111111'
    AND document_body='Texto publicado' AND revision_number=1 AND published_at IS NULL) THEN
    RAISE EXCEPTION '009: publicación heredada alterada o fecha histórica inventada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.lesson_revisions r
    WHERE r.institutional_lesson_id='44444444-4444-4444-8444-444444444444'
      AND r.organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN
    RAISE EXCEPTION '009: aislamiento institucional incorrecto';
  END IF;
  IF (SELECT count(*) FROM app.lessons) <> 4
     OR (SELECT count(*) FROM app.offering_lessons) <> 3 THEN
    RAISE EXCEPTION '009: modificó el catálogo heredado';
  END IF;
  SELECT r.id INTO pub FROM app.lesson_revisions r
  WHERE r.institutional_lesson_id='11111111-1111-4111-8111-111111111111';
  BEGIN
    INSERT INTO app.lesson_revisions
      (organization_id,institutional_lesson_id,base_revision_id,revision_state,
       document_format,document_body,title)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '33333333-3333-4333-8333-333333333333',pub,'draft','plain-text-v1','Otro','Prueba');
    RAISE EXCEPTION '009: permitió una revisión base de OTRA lección';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO app.lesson_revisions
      (organization_id,institutional_lesson_id,revision_state,document_format,document_body,title)
    VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111','draft','plain-text-v1','Otro','Prueba');
    RAISE EXCEPTION '009: permitió referencia entre instituciones';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO app.lesson_revisions
      (organization_id,institutional_lesson_id,revision_state,document_format,document_body,title)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '22222222-2222-4222-8222-222222222222','draft','plain-text-v1','Duplicado','Prueba');
    RAISE EXCEPTION '009: permitió segundo borrador de una lección';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
    WHERE oid='app.lesson_revisions'::regclass) THEN
    RAISE EXCEPTION '009: RLS no está habilitada y forzada';
  END IF;
END $$;
SELECT 'OK: 009 preserva datos, versiones, límites y aislamiento' AS comprobacion;
