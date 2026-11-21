-- EduMaster.ai: aprovisionamiento EXCEPCIONAL del primer superadministrador.
-- Solo ejecutar manualmente desde Supabase SQL Editor como propietario.
-- No incorporar este SQL al frontend, a endpoints de alta ni a migraciones públicas.
-- Sustituye la dirección debajo por el correo REAL ya registrado en Supabase Auth.
-- Puedes volver a ejecutarlo: los INSERT son idempotentes.

BEGIN;
DO $bootstrap$
DECLARE
  bootstrap_email text := lower(btrim('REEMPLAZA_POR_TU_CORREO@EJEMPLO.COM'));
  auth_id uuid;
  app_id uuid;
  role_id uuid;
BEGIN
  IF bootstrap_email LIKE '%ejemplo.com' THEN
    RAISE EXCEPTION 'Sustituye el correo de ejemplo antes de ejecutar';
  END IF;

  SELECT id INTO auth_id FROM auth.users WHERE lower(email) = bootstrap_email;
  IF auth_id IS NULL THEN
    RAISE EXCEPTION 'No existe una cuenta Auth con el correo indicado';
  END IF;

  SELECT id INTO role_id FROM app.roles
    WHERE code = 'superadmin' AND scope = 'global';
  IF role_id IS NULL THEN
    RAISE EXCEPTION 'Falta el catálogo de rol superadmin';
  END IF;

  -- La cuenta debe haber sido creada previamente por el administrador en Auth.
  INSERT INTO app.users (auth_user_id, email_normalized, full_name)
  VALUES (auth_id, bootstrap_email, 'Superadministrador de desarrollo')
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT id INTO app_id FROM app.users
    WHERE auth_user_id = auth_id AND status = 'active';
  IF app_id IS NULL THEN
    RAISE EXCEPTION 'El usuario existe pero no está activo en app.users';
  END IF;

  -- Solo el primer administrador autorizado por SQL recibe el rol global.
  INSERT INTO app.global_role_assignments (user_id, role_id)
  VALUES (app_id, role_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Superadministrador de desarrollo habilitado para %', bootstrap_email;
END;
$bootstrap$;
COMMIT;

-- Verificación manual: cambia el correo también en esta consulta.
SELECT u.email_normalized AS correo, u.status, r.code AS rol, r.scope AS ambito
FROM app.users u
JOIN app.global_role_assignments gra ON gra.user_id = u.id
JOIN app.roles r ON r.id = gra.role_id
WHERE u.email_normalized = lower('REEMPLAZA_POR_TU_CORREO@EJEMPLO.COM');
