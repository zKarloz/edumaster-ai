-- EduMaster.ai v15: atributos personales opcionales y lectura autorizada de avatares.
-- EJECUTAR UNA SOLA VEZ en Supabase SQL Editor, DESPUÉS de 003_avatar_policies.sql.
-- No publica datos privados en la Data API ni concede lectura directa a app.*.
BEGIN;

CREATE TABLE IF NOT EXISTS app.user_profile_details (
    user_id UUID PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
    language_code TEXT CHECK (language_code IS NULL OR language_code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$'),
    country_code TEXT CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    birth_date DATE CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE),
    sex TEXT CHECK (sex IS NULL OR sex IN ('female', 'male', 'non_binary', 'prefer_not_to_say')),
    share_locale_with_staff BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app.user_profile_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_profile_details FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.user_profile_details FROM PUBLIC, anon, authenticated;

-- Las fotos continúan privadas, pero administradores autorizados pueden ver
-- exclusivamente los avatares de usuarios vinculados a su institución.
-- SECURITY DEFINER permite consultar las tablas privadas sin GRANT SELECT.
CREATE OR REPLACE FUNCTION app.can_view_member_avatar(target_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.users viewer, app.users target
    WHERE viewer.auth_user_id = auth.uid() AND viewer.status = 'active'
      AND target.auth_user_id = target_auth_id AND target.status = 'active'
      AND (
        EXISTS (
          SELECT 1 FROM app.global_role_assignments ga
          JOIN app.roles r ON r.id=ga.role_id
          WHERE ga.user_id=viewer.id AND r.code='superadmin' AND r.scope='global'
        )
        OR EXISTS (
          SELECT 1 FROM app.organization_memberships vm
          JOIN app.organizations o ON o.id=vm.organization_id AND o.status='active'
          JOIN app.membership_roles mr ON mr.membership_id=vm.id
          JOIN app.roles r ON r.id=mr.role_id AND r.code='institution_admin'
          JOIN app.organization_memberships tm
            ON tm.organization_id=vm.organization_id AND tm.user_id=target.id AND tm.status='active'
          WHERE vm.user_id=viewer.id AND vm.status='active'
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION app.can_view_member_avatar(UUID) FROM PUBLIC;
-- Solo ejecutar funciones explícitamente autorizadas; no concede acceso a tablas.
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT EXECUTE ON FUNCTION app.can_view_member_avatar(UUID) TO authenticated;

DROP POLICY IF EXISTS edumaster_avatar_admin_read ON storage.objects;
CREATE POLICY edumaster_avatar_admin_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='profile-avatars'
  AND CASE WHEN name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/avatar[.]jpg$'
    THEN app.can_view_member_avatar(split_part(name, '/', 1)::UUID)
    ELSE FALSE END
);
COMMIT;
