BEGIN;
-- Extender el registro existente sin alterar avisos ni estados de lectura.
-- El autor de la publicación de una tarea puede diferir de quien la creó.
ALTER TABLE app.course_tasks ADD COLUMN published_by uuid REFERENCES app.users(id) ON DELETE SET NULL;
ALTER TABLE app.notifications DROP CONSTRAINT notifications_event_type_check,
 DROP CONSTRAINT notifications_resource_type_check,
 DROP CONSTRAINT notifications_resource_id_fkey;
ALTER TABLE app.notifications ADD CONSTRAINT notifications_event_resource_check CHECK (
 (event_type='recommendation_created' AND resource_type='teacher_recommendation') OR
 (event_type='task_published' AND resource_type='course_task') OR
 (event_type='task_submitted' AND resource_type='task_submission') OR
 (event_type='grade_issued' AND resource_type='task_grade') OR
 (event_type IN ('community_announcement','community_question') AND resource_type='community_post') OR
 (event_type='community_reply' AND resource_type='community_comment')
);
-- Vistas privadas: permisos actuales de estudiantes y docente asignado.
CREATE VIEW app.notification_students AS
 SELECT DISTINCT e.organization_id,e.offering_id,e.id AS enrollment_id,m.user_id
 FROM app.enrollments e
 JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id AND s.status='active'
 JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=s.organization_id AND m.status='active'
 JOIN app.users u ON u.id=m.user_id AND u.status='active'
 JOIN app.course_offerings off ON off.id=e.offering_id AND off.organization_id=e.organization_id AND off.status<>'cancelled'
 JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id AND c.status='published'
 JOIN app.organizations o ON o.id=e.organization_id AND o.status='active'
 WHERE e.status IN ('active','completed');
CREATE VIEW app.notification_teachers AS
 SELECT DISTINCT off.organization_id,off.id AS offering_id,m.user_id
 FROM app.course_offerings off
 JOIN app.instructors i ON i.id=off.instructor_id AND i.organization_id=off.organization_id AND i.status='active'
 JOIN app.organization_memberships m ON m.id=i.membership_id AND m.organization_id=i.organization_id AND m.status='active'
 JOIN app.membership_roles mr ON mr.membership_id=m.id
 JOIN app.roles r ON r.id=mr.role_id AND r.code='instructor' AND r.scope='organization'
 JOIN app.users u ON u.id=m.user_id AND u.status='active'
 JOIN app.organizations o ON o.id=off.organization_id AND o.status='active'
 JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id AND c.status<>'archived'
 WHERE off.status<>'cancelled';
-- Cada fila es un recurso visible para un destinatario, no un aviso histórico.
CREATE VIEW app.notification_academic_events AS
 SELECT 'task_published'::text AS event_type,'course_task'::text AS resource_type,
 t.id AS resource_id,t.organization_id,t.offering_id,s.user_id AS recipient_id,coalesce(t.published_by,t.created_by) AS actor_id,
 t.id AS target_id,t.title
 FROM app.course_tasks t JOIN app.notification_students s USING (organization_id,offering_id)
 WHERE t.status IN ('published','closed')
 UNION ALL
 SELECT 'task_submitted','task_submission',x.id,x.organization_id,x.offering_id,d.user_id,s.user_id,t.id,t.title
 FROM app.task_submissions x
 JOIN app.course_tasks t ON t.id=x.task_id AND t.organization_id=x.organization_id AND t.offering_id=x.offering_id
 JOIN app.notification_teachers d ON d.organization_id=x.organization_id AND d.offering_id=x.offering_id
 JOIN app.enrollments e ON e.id=x.enrollment_id AND e.organization_id=x.organization_id
 JOIN app.students st ON st.id=e.student_id AND st.organization_id=e.organization_id
 JOIN app.organization_memberships s ON s.id=st.membership_id AND s.organization_id=st.organization_id
 UNION ALL
 SELECT 'grade_issued','task_grade',g.id,g.organization_id,g.offering_id,s.user_id,g.graded_by,t.id,t.title
 FROM app.task_official_grades g
 JOIN app.course_tasks t ON t.id=g.task_id AND t.organization_id=g.organization_id AND t.offering_id=g.offering_id
 JOIN app.notification_students s ON s.enrollment_id=g.enrollment_id AND s.organization_id=g.organization_id AND s.offering_id=g.offering_id
 JOIN app.academic_activity_records a ON a.id=g.academic_record_id AND a.organization_id=g.organization_id AND a.voided_at IS NULL
 WHERE t.status IN ('published','closed')
 UNION ALL
 SELECT 'community_announcement','community_post',p.id,p.organization_id,p.offering_id,s.user_id,p.author_id,p.id,p.title
 FROM app.community_posts p JOIN app.notification_students s USING (organization_id,offering_id)
 WHERE p.kind='announcement' AND p.hidden_at IS NULL
 UNION ALL
 SELECT 'community_question','community_post',p.id,p.organization_id,p.offering_id,d.user_id,p.author_id,p.id,p.title
 FROM app.community_posts p JOIN app.notification_teachers d USING (organization_id,offering_id)
 WHERE p.kind='question' AND p.hidden_at IS NULL
 UNION ALL
 SELECT 'community_reply','community_comment',x.id,x.organization_id,x.offering_id,p.author_id,x.author_id,p.id,p.title
 FROM app.community_comments x JOIN app.community_posts p ON p.id=x.post_id AND p.organization_id=x.organization_id AND p.offering_id=x.offering_id
 WHERE x.hidden_at IS NULL AND p.hidden_at IS NULL AND EXISTS (
 SELECT 1 FROM (SELECT organization_id,offering_id,user_id FROM app.notification_students
 UNION SELECT organization_id,offering_id,user_id FROM app.notification_teachers) a
 WHERE a.organization_id=p.organization_id AND a.offering_id=p.offering_id AND a.user_id=p.author_id);
REVOKE ALL ON app.notification_students,app.notification_teachers,app.notification_academic_events FROM PUBLIC,anon,authenticated;
-- Trigger invocador: misma transacción, sin privilegios elevados ni datos privados en payload.
CREATE FUNCTION app.notify_academic_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
BEGIN
 INSERT INTO app.notifications(organization_id,recipient_id,actor_id,event_type,resource_type,resource_id,deduplication_key)
 SELECT DISTINCT v.organization_id,v.recipient_id,v.actor_id,v.event_type,v.resource_type,v.resource_id,
 v.event_type || ':' || v.resource_id::text
 FROM app.notification_academic_events v
 WHERE v.resource_id=NEW.id AND v.organization_id=NEW.organization_id
 AND v.event_type=TG_ARGV[0] AND v.actor_id IS NOT NULL AND v.actor_id<>v.recipient_id
 AND (v.event_type NOT IN ('task_published','community_announcement') OR EXISTS (
   SELECT 1 FROM app.notification_students s JOIN app.enrollments e
     ON e.id=s.enrollment_id AND e.organization_id=s.organization_id AND e.status='active'
   WHERE s.organization_id=v.organization_id AND s.offering_id=v.offering_id AND s.user_id=v.recipient_id
 ))
 ON CONFLICT (recipient_id,deduplication_key) DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app.notify_academic_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_task_published AFTER UPDATE OF status ON app.course_tasks FOR EACH ROW
 WHEN (OLD.status='draft' AND NEW.status='published') EXECUTE FUNCTION app.notify_academic_event('task_published');
CREATE TRIGGER notify_task_submitted AFTER INSERT ON app.task_submissions FOR EACH ROW EXECUTE FUNCTION app.notify_academic_event('task_submitted');
CREATE TRIGGER notify_grade_issued AFTER INSERT ON app.task_official_grades FOR EACH ROW EXECUTE FUNCTION app.notify_academic_event('grade_issued');
CREATE TRIGGER notify_community_announcement AFTER INSERT ON app.community_posts FOR EACH ROW
 WHEN (NEW.kind='announcement') EXECUTE FUNCTION app.notify_academic_event('community_announcement');
CREATE TRIGGER notify_community_question AFTER INSERT ON app.community_posts FOR EACH ROW
 WHEN (NEW.kind='question') EXECUTE FUNCTION app.notify_academic_event('community_question');
CREATE TRIGGER notify_community_reply AFTER INSERT ON app.community_comments FOR EACH ROW EXECUTE FUNCTION app.notify_academic_event('community_reply');
COMMIT;
