-- Lectura privada de fotos de autores visibles, únicamente en ofertas autorizadas.
BEGIN;
CREATE OR REPLACE FUNCTION app.can_view_community_avatar(target_auth_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM app.users viewer
  JOIN app.organization_memberships vm ON vm.user_id=viewer.id AND vm.status='active'
  JOIN app.organizations o ON o.id=vm.organization_id AND o.status='active'
  JOIN app.course_offerings off ON off.organization_id=o.id AND off.status<>'cancelled'
  JOIN app.courses c ON c.organization_id=o.id AND c.id=off.course_id
  JOIN app.users target ON target.auth_user_id=target_auth_id AND target.status='active'
  WHERE viewer.auth_user_id=auth.uid() AND viewer.status='active'
  AND (
   EXISTS (SELECT 1 FROM app.membership_roles mr JOIN app.roles r ON r.id=mr.role_id
    WHERE mr.membership_id=vm.id AND r.scope='organization' AND r.code IN ('institution_admin','coordinator'))
   OR EXISTS (SELECT 1 FROM app.instructors i JOIN app.membership_roles mr ON mr.membership_id=vm.id
    JOIN app.roles r ON r.id=mr.role_id AND r.scope='organization' AND r.code='instructor'
    WHERE i.id=off.instructor_id AND i.organization_id=o.id AND i.membership_id=vm.id AND i.status='active')
   OR (c.status='published' AND EXISTS (SELECT 1 FROM app.enrollments e JOIN app.students s
    ON s.id=e.student_id AND s.organization_id=e.organization_id AND s.status='active'
    WHERE e.organization_id=o.id AND e.offering_id=off.id AND s.membership_id=vm.id
    AND e.status IN ('active','completed')))
  )
  AND EXISTS (SELECT 1 FROM app.community_posts p WHERE p.organization_id=o.id AND p.offering_id=off.id
   AND p.hidden_at IS NULL AND (p.author_id=target.id OR EXISTS (
    SELECT 1 FROM app.community_comments cm WHERE cm.organization_id=o.id AND cm.offering_id=off.id
     AND cm.post_id=p.id AND cm.hidden_at IS NULL AND cm.author_id=target.id)))
 );
$$;
REVOKE ALL ON FUNCTION app.can_view_community_avatar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_view_community_avatar(uuid) TO authenticated;
DROP POLICY IF EXISTS edumaster_avatar_community_read ON storage.objects;
CREATE POLICY edumaster_avatar_community_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='profile-avatars' AND CASE WHEN name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/avatar[.]jpg$'
 THEN app.can_view_community_avatar(split_part(name,'/',1)::uuid) ELSE FALSE END
);
COMMIT;
