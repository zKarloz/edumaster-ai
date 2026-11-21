# EduMaster.ai — Login obligatorio y bootstrap de superadministrador

## Causa del 401
El frontend se autenticaba correctamente en Supabase Auth, pero la API verificaba la firma del JWT antes de consultar roles. La versión inicial solo acepta tokens firmados con ES256 o RS256 mediante el JWKS del proyecto. **Un 401 no se corrige insertando roles SQL**.

En Supabase: **Project Settings → JWT Signing Keys** (puede aparecer como **JWT Keys / Signing Keys** según la versión). Confirmar que la clave **in use** emplea ES256 o RS256. Si está en HS256, utilizar el proceso oficial de migración a clave asimétrica y rotación; después cerrar sesión y volver a iniciarla para obtener token nuevo.

Referencia oficial: https://supabase.com/docs/guides/auth/signing-keys

## Asignar el primer superadministrador (solo en desarrollo)

1. Crear/verificar cuenta en **Supabase → Authentication → Users**.
2. Abrir `database/admin/002_bootstrap_superadmin.sql`.
3. Cambiar las **dos** apariciones de `REEMPLAZA_POR_TU_CORREO@EJEMPLO.COM` por el correo de la cuenta que controla el proyecto.
4. Ejecutar manualmente **una sola vez** desde SQL Editor como administrador (el archivo permite repetir sin duplicar).
5. Comprobar que la consulta final devuelve `superadmin` con `scope=global`.
6. No ejecutar este script para usuarios nuevos ni añadirlo a un endpoint público.

**Importante:** `superadmin` es un rol global que se guarda en `app.global_role_assignments`, **no** en `app.membership_roles`. La API de instituciones se actualizó para reconocerlo. Si no existe ninguna institución, `/api/v1/organizations` devolverá `items: []` aunque el rol sea correcto.

## Aplicar los cambios de código

Sobrescribir en el repositorio los archivos del ZIP parche respetando las rutas:

- `apps/web/src/App.tsx`
- `apps/web/src/LoginScreen.tsx` (nuevo)
- `apps/api/app/routers/organizations.py`
- `apps/api/tests/test_health.py`
- `database/admin/002_bootstrap_superadmin.sql` (nuevo; para SQL Editor)

**No reemplazar los dos archivos `.env`.**

## Comprobaciones

**Backend** (terminal Git Bash en `apps/api`, entorno virtual activo):

```bash
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend** (terminal Git Bash en `apps/web`):

```bash
npm run build
npm run dev
```

**Prueba de acceso:** sin sesión se ve únicamente la pantalla de login. Tras autenticarse, el frontend consulta `GET /api/v1/me` con el token JWT del usuario antes de abrir el dashboard.

Interpretación de respuestas:

| Estado | Significado |
| --- | --- |
| 200 | JWT válido y cuenta habilitada con rol/membresía. |
| 401 | JWT faltante, vencido o no válido. Comprobar firma y URL del proyecto. |
| 403 | JWT correcto, pero la cuenta no existe en `app.users`, no está activa o carece de rol/membresía activa. |
| 500/503 | Posible problema de conectividad/configuración de PostgreSQL o API (inspeccionar logs sin compartir secretos). |

La nueva pantalla de login no sustituye autorización de backend. Todas las rutas de datos deben permanecer protegidas.

## Alcance inicial

- No hay alta pública automática de administradores. Aprovisionamiento manual seguro para el primer usuario.
- La base de datos sigue usando el esquema `app` privado sin Data API.
- El modo DEMO sin sesión deja de estar visible por defecto; la demostración será con una cuenta de pruebas.
- El mapa y la red neuronal siguen pendientes del siguiente bloque de desarrollo.
