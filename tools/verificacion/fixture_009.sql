-- CAMBIOS 20 · Datos ficticios para probar 009 en una BD DESECHABLE.
-- Este archivo crea un esquema app desde cero. NUNCA usar en Supabase producción.
CREATE SCHEMA app;
CREATE TABLE app.organizations (id UUID PRIMARY KEY);
CREATE TABLE app.users (id UUID PRIMARY KEY);
CREATE TABLE app.lessons (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL,
  title TEXT NOT NULL, content TEXT, status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id,id)
);
CREATE TABLE app.offering_lessons (
  id UUID PRIMARY KEY, organization_id UUID NOT NULL,
  title TEXT NOT NULL, content TEXT, status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id,id)
);
CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
INSERT INTO app.organizations VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO app.users VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO app.lessons (id,organization_id,title,content,status,created_at,updated_at) VALUES
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Publicado','Texto publicado','published','2026-10-01','2026-10-02'),
  ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Borrador',NULL,'draft','2026-10-03','2026-10-04'),
  ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Archivado','','archived','2026-10-05','2026-10-06'),
  ('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Otra institución','Secreto institución B','published','2026-10-07','2026-10-08');
INSERT INTO app.offering_lessons (id,organization_id,title,content,status,created_at,updated_at) VALUES
  ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Oferta publicada','Oferta visible','published','2026-10-01','2026-10-02'),
  ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Oferta borrador','', 'draft','2026-10-03','2026-10-04'),
  ('77777777-7777-4777-8777-777777777777','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Oferta archivada',NULL,'archived','2026-10-05','2026-10-06');
