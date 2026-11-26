BEGIN;
-- Bandeja privada: el evento se crea dentro de la transacción de la recomendación.
CREATE TABLE app.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES app.organizations(id),
 recipient_id uuid NOT NULL REFERENCES app.users(id),
 actor_id uuid NOT NULL REFERENCES app.users(id),
 event_type text NOT NULL CHECK (event_type = 'recommendation_created'),
 resource_type text NOT NULL CHECK (resource_type = 'teacher_recommendation'),
 resource_id uuid NOT NULL REFERENCES app.teacher_recommendations(id),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 deduplication_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE (recipient_id, deduplication_key)
);
CREATE INDEX notifications_recipient_idx ON app.notifications(recipient_id, created_at DESC);
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.notifications FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app.notify_recommendation_created() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, app AS $$
BEGIN
 INSERT INTO app.notifications(organization_id,recipient_id,actor_id,event_type,resource_type,resource_id,deduplication_key)
 SELECT NEW.organization_id,m.user_id,NEW.created_by,'recommendation_created','teacher_recommendation',NEW.id,
        'recommendation_created:' || NEW.id::text
 FROM app.enrollments e
 JOIN app.students s ON s.organization_id=e.organization_id AND s.id=e.student_id
 JOIN app.organization_memberships m ON m.organization_id=s.organization_id AND m.id=s.membership_id
 JOIN app.users u ON u.id=m.user_id
 WHERE e.organization_id=NEW.organization_id AND e.id=NEW.enrollment_id
 AND e.status='active' AND s.status='active' AND m.status='active' AND u.status='active'
 AND m.user_id<>NEW.created_by
 ON CONFLICT (recipient_id,deduplication_key) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.notify_recommendation_created() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_recommendation_created AFTER INSERT ON app.teacher_recommendations
FOR EACH ROW EXECUTE FUNCTION app.notify_recommendation_created();
COMMIT;
