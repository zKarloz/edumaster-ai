# Base de datos · EduMaster.ai

## Ejecutar la migración inicial en Supabase

1. Crea un **proyecto Supabase Free** dedicado a desarrollo (un proyecto puede
   alojar múltiples instituciones en el mismo esquema `app`).
2. Abre **SQL Editor** en Supabase y ejecuta el archivo
   `migrations/001_initial_schema.sql` íntegramente y una sola vez.
3. Comprueba: `select tablename from pg_tables where schemaname='app';`.
4. Mantén el esquema `app` fuera de los esquemas expuestos por la Data API.
5. Para la API usa **Connect → Session pooler (5432)** si tu red requiere IPv4.
   `DATABASE_URL` debe comenzar por `postgresql+asyncpg://`.
6. No introducir datos reales ni invitar estudiantes antes de terminar el modelo
   de permisos y el proceso de alta segura.

## Aprovisionamiento inicial: operación administrativa CONTROLADA

Después de crear una cuenta en **Authentication → Users**, sustituye el UUID y
los demás datos. No ejecutes este ejemplo con IDs inventados:

```sql
-- Ejecutar sólo para una cuenta REAL creada en Supabase Auth.
-- Los UUID se generan automáticamente salvo el identificador auth_user_id.
BEGIN;
INSERT INTO app.organizations (code, name, timezone)
VALUES ('institucion-demo', 'Institución de pruebas', 'America/Lima');

INSERT INTO app.users (auth_user_id, email_normalized, full_name)
VALUES ('UUID-REAL-DEL-USUARIO-AUTH', 'correo@ejemplo.com', 'Administrador de pruebas');

INSERT INTO app.organization_memberships (organization_id, user_id, status, joined_at)
SELECT o.id, u.id, 'active', now()
FROM app.organizations o CROSS JOIN app.users u
WHERE o.code = 'institucion-demo' AND u.email_normalized = 'correo@ejemplo.com';

INSERT INTO app.membership_roles (membership_id, role_id)
SELECT m.id, r.id
FROM app.organization_memberships m
JOIN app.organizations o ON o.id = m.organization_id
CROSS JOIN app.roles r
WHERE o.code = 'institucion-demo' AND r.code = 'institution_admin';
COMMIT;
```

**No incluir** este SQL de alta en una página abierta a visitantes.

## Seguridad de la primera migración

- `app.users` referencia `auth.users` (el archivo está pensado para Supabase).
- RLS activado sobre las tablas, sin políticas públicas ni GRANTs a clientes.
- Las credenciales privilegiadas de conexión pueden ignorar RLS. Por ello, los
  endpoints validan el JWT y comprueban membresía antes de leer.
- El catálogo `role_permissions` todavía **no tiene asignaciones** de acciones.
  No hay endpoints de edición: la autorización por rol se construye en Sprint 1.
- Los certificados, la red neuronal y la analítica avanzada requieren más
  migraciones y revisiones de negocio.
