BEGIN;
-- Recomendaciones privadas por matrícula; no afectan calificaciones.
CREATE TABLE app.teacher_recommendations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 enrollment_id uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 150),
 body text NOT NULL CHECK (length(btrim(body)) BETWEEN 5 AND 3000),
 priority text NOT NULL CHECK (priority IN ('normal','high')),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 FOREIGN KEY (organization_id,enrollment_id) REFERENCES app.enrollments(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX teacher_recommendations_enrollment_idx ON app.teacher_recommendations(organization_id,enrollment_id,created_at DESC);
ALTER TABLE app.teacher_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.teacher_recommendations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.teacher_recommendations FROM PUBLIC, anon, authenticated;
COMMIT;
