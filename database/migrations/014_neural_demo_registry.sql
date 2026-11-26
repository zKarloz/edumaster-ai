BEGIN;
-- Registro global de candidatos DEMO, nunca modelos académicos aprobados.
CREATE TABLE app.neural_demo_models (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz,
 dataset_hash text NOT NULL CHECK (length(dataset_hash)=64),
 checkpoint jsonb NOT NULL CHECK (jsonb_typeof(checkpoint)='object' AND octet_length(checkpoint::text)<=262144)
);
CREATE INDEX neural_demo_models_recent_idx ON app.neural_demo_models(created_at DESC);
ALTER TABLE app.neural_demo_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.neural_demo_models FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.neural_demo_models FROM PUBLIC, anon, authenticated;
COMMIT;
