# EduMaster.ai — Incremento v13: Usuarios institucionales

## Objetivo

Un usuario con rol `institution_admin` podrá gestionar **únicamente los miembros de su institución**, mediante cuentas existentes y confirmadas de **Supabase Auth**. El superadministrador conserva el módulo global v12 para asignar y revocar administradores institucionales.

## Instalación del parche (sobre v12)

1. Haz una copia de seguridad de tu proyecto. Descomprime el ZIP de parche **en la carpeta que contiene `edumaster-ai/`**, conservando las rutas. Nunca reemplaces `.env`.
2. No ejecutes migraciones SQL ni el script `001_initial_schema.sql`: las tablas actuales son suficientes.
3. Reinicia FastAPI desde `edumaster-ai/apps/api`:

   ```bash
   source .venv/Scripts/activate
   python -m pytest -q
   python -m uvicorn app.main:app --reload --port 8000
   ```

4. Reinicia Vite desde `edumaster-ai/apps/web`:

   ```bash
   npm run build
   npm run dev
   ```

5. Cierra sesión y vuelve a ingresar como el **administrador institucional** para recuperar los permisos actuales en `/api/v1/me`.

No se agregan dependencias npm ni Python, servicios nuevos ni secretos. El backend sigue usando `DATABASE_URL` y la verificación de JWT ya configurada.

## Funcionalidades

- **Usuarios / superadministrador:** se mantiene la pantalla global v12, donde asigna `institution_admin` por institución.
- **Usuarios / administrador institucional:** directorio de miembros de las instituciones que administra (lista, búsqueda y tabla paginada), con selector de institución si administra varias.
- **Incorporar usuario:** requiere correo **confirmado y existente en Supabase Auth**, nombre y primer rol institucional. Si la cuenta ya existe en `app.users`, se reutiliza. Una cuenta puede tener varios roles y pertenecer a varias instituciones.
- **Roles delegables:** `coordinator`, `instructor`, `student`, `analyst` y `ml_engineer` (el último **no habilita por sí mismo** acceso a datasets sensibles ni entrenamiento).
- **Asignar y retirar roles adicionales:** se mantienen los demás roles e historial; no se permite retirar el último rol de una membresía activa ni retirar un rol de estudiante con matrículas activas o docente con ofertas activas/planificadas.
- **Suspender/reactivar:** solo cambia la membresía de la institución elegida. No elimina credenciales de Supabase ni registros académicos. Las membresías previamente revocadas/invitadas requieren revisión adicional.
- **Estudiantes y docentes:** al asignar `student` o `instructor`, se crea o reactiva su perfil `app.students` / `app.instructors` de forma idempotente. **No vuelvas a incorporarlos por segunda vez en el módulo Estudiantes.** Ya aparecerán en el listado de esa institución, listos para matrícula. Puedes asignarles un código académico cuando implementemos la edición del perfil.

## Restricciones de seguridad

- El permiso se valida **en cada endpoint FastAPI**, con usuario activo, membresía activa, rol `institution_admin` e institución activa.
- El servidor vuelve a comprobar ese permiso bajo el bloqueo de la institución antes de modificar cualquier dato; previene carreras con revocaciones de administradores.
- No se puede gestionar otra institución ni modificar la propia membresía del administrador.
- Los roles `superadmin`, `institution_admin` y `auditor` **no son delegables** por administradores locales. Las cuentas administrativas o con privilegios globales se muestran como protegidas y no pueden modificarse desde la administración local.
- Las operaciones de alta, asignación, retirada de roles y suspensión/reactivación se registran en `app.audit_logs` dentro de la misma transacción.
- El selector de instituciones del frontend **no es la frontera de seguridad**: los permisos también se validan en FastAPI.
- No se expone la contraseña de PostgreSQL ni claves administrativas de Supabase en el frontend. No se crean cuentas de Auth automáticamente en esta versión.

## Flujo de prueba con las instituciones existentes

1. En **Supabase → Authentication → Users** crea una **cuenta DEMO con correo confirmado** para un docente de tu institución de Lima. Usa un correo de prueba al que tengas permiso de acceso y evita cuentas reales de estudiantes.
2. Inicia sesión como el administrador de **Lima** y abre **Usuarios → Incorporar usuario**.
3. Ingresa el correo de Auth, nombre y rol **Docente / Instructor**. Revisa y confirma. Comprueba la fila y su rol en el listado.
4. Crea otra cuenta DEMO confirmada, esta vez con rol **Estudiante**. Comprueba que aparece automáticamente en **Estudiantes**.
5. Abre **Matrículas** y matricula al estudiante en uno de los dos cursos publicados que ya creaste. El flujo seguirá siendo académico real, con las tablas existentes.
6. Regresa a **Usuarios**; verifica que puedes agregar un segundo rol, suspender y reactivar a un usuario de prueba sin cambiar su cuenta global. No suspendas un usuario que estés usando para otras pruebas.
7. Comprueba el aislamiento: desde Lima no deben aparecer ni poder modificarse los miembros de México. Aunque se modifique manualmente la URL o el cuerpo de la petición a la API, debe responder **403 o 404** en los intentos no autorizados.
8. Comprueba desde el superadministrador que **Usuarios** sigue mostrando la administración global y no permite operar académicamente sin membresía institucional.

## API nueva (JWT obligatorio)

Prefijo: `/api/v1/institutional/organizations/{organization_id}`

| Método | Ruta | Acción |
|---|---|---|
| GET | `/members` | Lista miembros autorizados de esa institución |
| POST | `/members` | Vincula cuenta confirmada y asigna primer rol |
| POST | `/members/{membership_id}/roles` | Añade rol local permitido |
| DELETE | `/members/{membership_id}/roles/{role}` | Retira rol local (con reglas académicas) |
| PATCH | `/members/{membership_id}/status` | Suspende o reactiva membresía |

## Limitaciones actuales

- Esta versión **no envía invitaciones por correo ni crea credenciales**: Supabase Auth debe contener la cuenta antes de vincularla. El flujo de invitaciones se construirá más adelante con una credencial de servidor y configuración de correo.
- El directorio institucional consulta hasta **500 miembros por institución** por ahora y pagina en el navegador. Para producción, añadiremos paginación en FastAPI y búsqueda en servidor.
- No existe todavía la edición del nombre institucional, los códigos académicos o el alta automática de usuarios externos.
- El rol de ML queda catalogado pero **no da permisos automáticos para utilizar datos sensibles**; esos flujos requieren un diseño adicional de autorización.
- No se ha comprobado una operación contra tu Supabase real desde este entorno. Las pruebas automatizadas utilizan dobles de base de datos.

## Estado de verificación

- **84 pruebas de FastAPI superadas**, incluidas 35 nuevas de permisos, roles, membresías, protecciones y aislamiento.
- **20 archivos TS/TSX** revisados sintácticamente con TypeScript.
- La compilación completa `npm run build` y la prueba en navegador **deben ejecutarse en tu VSCode**, porque este entorno no pudo instalar las dependencias de npm.
