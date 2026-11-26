BEGIN;
-- Ampliación compatible con los avisos históricos de 019 y 020.
-- Los recordatorios son automáticos: no atribuirlos a una persona.
ALTER TABLE app.notifications ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE app.notifications DROP CONSTRAINT notifications_event_resource_check;
ALTER TABLE app.notifications ADD CONSTRAINT notifications_event_resource_check CHECK (
 (event_type='recommendation_created' AND resource_type='teacher_recommendation') OR
 (event_type IN ('task_published','task_due_soon','task_grading_pending') AND resource_type='course_task') OR
 (event_type='task_submitted' AND resource_type='task_submission') OR
 (event_type='grade_issued' AND resource_type='task_grade') OR
 (event_type IN ('community_announcement','community_question') AND resource_type='community_post') OR
 (event_type='community_reply' AND resource_type='community_comment') OR
 (event_type IN ('enrollment_created','instructor_assigned') AND resource_type='academic_audit')
);
-- Las reglas son evaluadas con la hora de PostgreSQL y el acceso vigente.
CREATE VIEW app.notification_reminder_events AS
 SELECT DISTINCT 'task_due_soon'::text AS event_type,'course_task'::text AS resource_type,
 t.id AS resource_id,t.organization_id,t.offering_id,s.user_id AS recipient_id,
 NULL::uuid AS actor_id,t.id AS target_id,t.title
 FROM app.course_tasks t JOIN app.notification_students s USING (organization_id,offering_id)
 JOIN app.enrollments e ON e.id=s.enrollment_id AND e.organization_id=s.organization_id
 JOIN app.course_offerings off ON off.id=t.offering_id AND off.organization_id=t.organization_id
 WHERE t.status='published' AND e.status='active' AND off.status='open'
 AND t.due_at>now() AND t.due_at<=now()+interval '48 hours'
 AND NOT EXISTS (SELECT 1 FROM app.task_submissions x WHERE x.organization_id=t.organization_id
 AND x.offering_id=t.offering_id AND x.task_id=t.id AND x.enrollment_id=e.id)
 UNION ALL
 SELECT DISTINCT 'task_grading_pending','course_task',t.id,t.organization_id,t.offering_id,d.user_id,
 NULL::uuid,t.id,t.title
 FROM app.course_tasks t JOIN app.notification_teachers d USING (organization_id,offering_id)
 WHERE t.status IN ('published','closed') AND EXISTS (
 SELECT 1 FROM app.task_submissions x WHERE x.organization_id=t.organization_id
 AND x.offering_id=t.offering_id AND x.task_id=t.id AND NOT EXISTS (SELECT 1 FROM app.task_official_grades g JOIN app.academic_activity_records a
 ON a.id=g.academic_record_id AND a.organization_id=g.organization_id AND a.voided_at IS NULL
 WHERE g.organization_id=x.organization_id AND g.offering_id=x.offering_id
 AND g.task_id=x.task_id AND g.enrollment_id=x.enrollment_id));
-- Gestores activos del tenant, sin conceder permisos por mera membresía.
CREATE VIEW app.notification_managers AS
 SELECT DISTINCT m.organization_id,m.user_id
 FROM app.organization_memberships m JOIN app.users u ON u.id=m.user_id AND u.status='active'
 JOIN app.organizations o ON o.id=m.organization_id AND o.status='active'
 JOIN app.membership_roles mr ON mr.membership_id=m.id
 JOIN app.roles r ON r.id=mr.role_id AND r.scope='organization' AND r.code IN ('institution_admin','coordinator')
 WHERE m.status='active';
-- Los eventos administrativos conservan su identificador de auditoría, incluso si se repite una asignación.
CREATE VIEW app.notification_management_events AS
 SELECT DISTINCT 'enrollment_created'::text AS event_type,'academic_audit'::text AS resource_type,
 a.id AS resource_id,a.organization_id,e.offering_id,m.user_id AS recipient_id,a.actor_id,
 e.id AS target_id,c.title
 FROM app.audit_logs a JOIN app.enrollments e ON e.id=a.resource_id AND e.organization_id=a.organization_id
 JOIN app.notification_managers m ON m.organization_id=e.organization_id
 JOIN app.course_offerings off ON off.id=e.offering_id AND off.organization_id=e.organization_id
 JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
 WHERE a.action='create' AND a.resource='enrollments' AND a.actor_id IS NOT NULL
 AND off.status<>'cancelled' AND c.status<>'archived'
 UNION ALL
 SELECT DISTINCT 'instructor_assigned','academic_audit',a.id,a.organization_id,d.offering_id,d.user_id,a.actor_id,
 d.offering_id,c.title
 FROM app.audit_logs a JOIN app.notification_teachers d ON d.offering_id=a.resource_id AND d.organization_id=a.organization_id
 JOIN app.course_offerings off ON off.id=d.offering_id AND off.organization_id=d.organization_id
 JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
 WHERE a.action='assign_instructor' AND a.resource='course_offerings' AND a.actor_id IS NOT NULL;
REVOKE ALL ON app.notification_reminder_events,app.notification_managers,app.notification_management_events FROM PUBLIC,anon,authenticated;
-- Se ejecuta dentro de la transacción de la acción administrativa, sin backfill.
CREATE FUNCTION app.notify_management_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
BEGIN
 INSERT INTO app.notifications(organization_id,recipient_id,actor_id,event_type,resource_type,resource_id,deduplication_key)
 SELECT DISTINCT v.organization_id,v.recipient_id,v.actor_id,v.event_type,v.resource_type,v.resource_id,
 v.event_type || ':' || v.resource_id::text
 FROM app.notification_management_events v WHERE v.resource_id=NEW.id AND v.organization_id=NEW.organization_id
 AND v.actor_id<>v.recipient_id
 ON CONFLICT (recipient_id,deduplication_key) DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app.notify_management_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_management_event AFTER INSERT ON app.audit_logs FOR EACH ROW
 WHEN ((NEW.action='create' AND NEW.resource='enrollments') OR
       (NEW.action='assign_instructor' AND NEW.resource='course_offerings'))
 EXECUTE FUNCTION app.notify_management_event();
COMMIT;
