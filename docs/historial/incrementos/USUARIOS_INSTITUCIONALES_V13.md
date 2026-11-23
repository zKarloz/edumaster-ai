# Incremento v13 — Roles locales con administración delegada

Arquitectura de permisos:

- **Global (`superadmin`)**: crea instituciones, asigna y revoca administradores de instituciones. No hace trabajo académico ordinario por defecto.
- **Local (`institution_admin`)**: gestiona miembros, perfiles docentes/alumnos y roles de su **propia organización**. El mismo usuario puede administrar más de una institución, siempre de forma independiente.
- **Roles locales delegables**: coordinador, docente, estudiante, analista, ML engineer. Auditor es una función de supervisión protegida. Superadmin y institution_admin no son delegables localmente.

Persistencia: `auth.users` (cuenta confirmada), `app.users` (identidad global), `app.organization_memberships` (ámbito), `app.membership_roles` (roles), `app.students` y `app.instructors` (perfiles asociados), `app.audit_logs` (trazabilidad). Todas estas tablas ya existen en `001_initial_schema.sql`.

Se preserva el aislamiento mediante comprobación en FastAPI, bloqueos de fila por organización, transacciones y restricciones compuestas de PostgreSQL. No se publican tablas privadas por Supabase Data API. No se crean ni utilizan secretos de Supabase en el cliente.

Diferencia importante: crear una **cuenta Auth** no implica darle acceso a EduMaster.ai. El acceso se obtiene cuando la cuenta confirmada se vincula y recibe roles activos. Tampoco todo rol de ML concede permisos para datos de entrenamiento.

Flujos: incorporación inicial → asignación de rol → creación de perfil académico si es docente/estudiante → gestión de cursos/matrículas. Un docente puede conservar un segundo rol local; suspender su membresía corta el acceso a esa institución sin afectar otros países.

Política docente-IA: estos permisos no autorizan a un modelo a enviar recomendaciones automáticamente al alumno; la revisión y aprobación docente continuará como paso obligatorio cuando se implemente ese módulo.
