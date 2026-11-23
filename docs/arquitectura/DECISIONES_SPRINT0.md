# EduMaster.ai · Decisiones técnicas del cierre del Sprint 0

**Fecha:** 19/11/2026 · **Versión de trabajo:** 0.1

Este repositorio implementa el punto de partida del **Documento maestro Enterprise**
(§3, §6–7, §10–11, §14–15) y del **Manual de funcionamiento**
(§3, §6–7, §12–14). Las estructuras adicionales son **decisiones de diseño
propuestas** para materializar los requisitos, no tablas textuales de los PDF.

| ID | Estado de diseño para starter | Decisión | Evidencia / observación |
|---|---|---|---|
| ADR-001 | Aprobada por PO | Multiinstitución desde la versión 1 | Conversación Sprint 0 |
| ADR-016 | Adoptada para baseline, validar formalmente | `app.users` global + `organization_memberships` | Admite una persona en instituciones A y B con distintos roles |
| ADR-017 | Adoptada para baseline, validar | FK compuestas `(organization_id,id)` | Bloquean integridad cruzada en Postgres |
| ADR-004 | Defensa adicional incluida, política pendiente | Esquema `app` privado con RLS habilitado, inicialmente sin políticas públicas | No sustituye autorización en FastAPI |
| ADR-021 | Propuesta | Supabase Auth como IdP; FastAPI verifica JWT asimétricos JWKS | Verificar firma, issuer, audience, exp y membership |
| ADR-022 | Propuesta | React Vite en Vercel, FastAPI en Render, Postgres en Supabase | Servicios gratuitos solo para desarrollo/demo |

## Fronteras de seguridad

1. `app` no se añade a los **Exposed schemas** de Supabase Data API.
2. El navegador recibe únicamente la URL y publishable key de Supabase para Auth;
   jamás `service_role`, contraseña de Postgres ni cadena `DATABASE_URL`.
3. FastAPI verifica JWT de Supabase con la clave pública JWKS para nuevos tokens
   firmados con ES256/RS256. Si Supabase usa aún el modo legado HS256,
   configurar claves asimétricas antes de usar estos endpoints.
4. FastAPI consulta `app.organization_memberships`, y filtra por `organization_id`.
   Hay que implementar permisos granulares RBAC/ABAC para escrituras y acceso sensible
   antes de poner módulos académicos en producción.
5. El usuario administrador de PostgreSQL puede ignorar RLS (BYPASSRLS). Las
   políticas de RLS implementadas con un rol restringido se dejarán para una
   migración auditada; no considerar que `FORCE ROW LEVEL SECURITY` protege a
   una conexión con rol privilegiado.
6. Las operaciones de inserción de matrícula/curso que alteren dos tablas deberán
   ejecutarse en una transacción con su evento Outbox.
7. No conceder rol superadmin mediante un formulario de auto-registro.

## Pendiente para Sprint 1

- Política de aprovisionamiento de `app.users` después de registro en Supabase Auth.
- Vistas de institución activa y cambio seguro entre membresías.
- Contratos de autorización y delegación `global_role_assignments`, `membership_roles`.
- Pruebas automáticas de acceso cruzado A ↔ B, incluidas referencias FK inválidas.
- Migraciones con Alembic y permisos mínimos para usuario runtime de base de datos.
- Backups, recuperación, reglas legales de datos estudiantiles y observabilidad.

La migración `001_initial_schema.sql` debe ejecutarse solo en un proyecto Supabase
vacío de desarrollo. Antes de producción se revisará cada permiso y sus índices.
