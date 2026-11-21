# Módulo Usuarios · asignación de administradores institucionales (v12)

## Alcance y separación de funciones

- **Superadministrador:** crea instituciones y asigna/revoca administradores institucionales; no realiza altas de cursos ni matrículas como parte de las operaciones cotidianas.
- **Administrador institucional:** crea cursos, gestiona estudiantes y matrículas **de sus propias instituciones**. En una futura entrega gestionará también docentes, coordinadores y otros roles de su ámbito.
- **Autenticación:** Supabase Auth valida la identidad y emite JWT. La API consulta `app.users`, las membresías y los roles para autorizar cada solicitud; nunca basta confiar en un campo de rol recibido del frontend.

## Componentes nuevos

- `apps/web/src/modules/users/UsersPage.tsx`: tabla compartida, filtros, formulario y confirmaciones.
- `apps/api/app/routers/user_administration.py`: rutas globales, validación transaccional y auditoría.
- `apps/api/tests/test_institution_admins.py`: regresiones de permisos, confirmación Auth, duplicados, aislamiento y último administrador.

## Contrato HTTP

| Verbo | Ruta | Permiso | Resultado |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/institution-admins` | superadmin | `{"items":[...]}` |
| POST | `/api/v1/admin/institution-admins` | superadmin | `201`, `{"membership_id":"...", "message":"..."}` |
| DELETE | `/api/v1/admin/institution-admins/{membership_id}` | superadmin | `200`, `{"message":"..."}` |

Payload POST: `{ "organization_id": "uuid", "email": "admin@ejemplo.edu", "reason": "opcional" }`.

**No** se acepta un campo `role`: el backend fija internamente `institution_admin`. Las operaciones validan `auth.users.email_confirmed_at`, el estado de `app.users`, el estado de la institución y la condición de membresía/rol existente. El alta y la auditoría se confirman o revierten en una sola transacción SQL.

## Datos persistidos

- `app.users` (identidad vinculada a Auth; nunca contraseña).
- `app.organization_memberships` (ámbito institucional).
- `app.membership_roles` (rol `institution_admin` con concedente y fecha).
- `app.audit_logs` (acciones `grant` / `revoke` con el actor y la institución).

No hay cambios en el esquema de PostgreSQL ni se modifica RLS.

## Política del último administrador

Revocar el último administrador activo podría dejar una institución inaccesible. Por eso la API exige que haya al menos **dos** administradores activos, con identidad EduMaster.ai habilitada, antes de efectuar la revocación. Un bloqueo `SELECT ... FOR UPDATE` de la fila de institución serializa concesiones/revocaciones concurrentes de ese ámbito.

## Pendiente en próximos incrementos

- Invitaciones automáticas mediante Supabase Auth Admin API, con secreto solo en FastAPI.
- Gestión de personal por parte de administradores institucionales (docentes, estudiantes, coordinadores).
- Alta/edición de perfiles, reenvío de invitaciones, gestión de suspensiones, paginación y filtros del lado servidor.
- Prueba E2E con Supabase real y compilación Vite en el VSCode del usuario.
