# EduMaster.ai — Hotfix v8: registro de instituciones (20 nov 2026)

## Resumen de las causas

1. El atributo `pattern` del input de código institucional usaba `[a-z0-9_-]`. Los navegadores modernos usan la bandera `v` en validación HTML y exigen escapar ciertos símbolos dentro de clases de caracteres. Se sustituyó por una alternativa portable: `[a-z0-9](?:[a-z0-9]|_|-){2,39}`. Además el formulario valida el código antes de enviar los datos.
2. PostgreSQL/asyncpg no podía inferir el tipo de `:country_code` en `jsonb_build_object`. Se añadió `CAST(:country_code AS text)` en la inserción de auditoría de `POST /api/v1/organizations`.
3. Un error de SQLAlchemy que terminaba en HTTP 500 sin control podía mostrarse como un error CORS en el navegador. El endpoint de creación ahora registra el fallo en el servidor y devuelve HTTP 503 con un mensaje entendible, preservando el middleware CORS habitual.
4. Se mejoró el mensaje del formulario para los fallos reales de conexión (FastAPI apagado, servidor inaccesible o CORS configurado incorrectamente).

## Archivos modificados

- `apps/api/app/routers/organizations.py`
- `apps/api/tests/test_organization_creation_regression.py` (nuevo)
- `apps/web/src/modules/organizations/OrganizationForm.tsx`
- `apps/web/src/App.tsx`

No requiere nuevas dependencias, migraciones SQL, cambios de RLS ni modificaciones de `.env`.

## Instalación recomendada

1. Crea una copia de respaldo de los archivos anteriores.
2. Extrae el ZIP en la carpeta **que contiene** `edumaster-ai` (no dentro de `edumaster-ai`, porque el ZIP ya incluye esa carpeta).
3. Reinicia FastAPI (desde `edumaster-ai/apps/api`):

```bash
source .venv/Scripts/activate
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

4. Abre otra terminal, desde `edumaster-ai/apps/web`:

```bash
npm run build
npm run dev
```

5. Recarga el navegador y reintenta el registro de la institución.

## Verificación antes de reintentar

En Supabase SQL Editor (esquema `app`), sustituye el código por el que intentaste registrar:

```sql
SELECT id, code, name, created_at
FROM app.organizations
WHERE code = 'pe-mi-institucion';
```

Lo esperado es **cero filas**, porque las inserciones en la tabla de instituciones, ubicaciones y auditoría usan la misma transacción PostgreSQL, que se revierte si ocurre una excepción. Si aparece alguna fila, confirma primero si esa institución ya está registrada, antes de reintentar y generar un código duplicado.

Después de registrar exitosamente, ejecuta esta comprobación para verificar ubicación:

```sql
SELECT o.code, o.name, loc.country_code, loc.city, loc.latitude, loc.longitude
FROM app.organizations AS o
JOIN app.organization_locations AS loc ON loc.organization_id = o.id
WHERE o.code = 'pe-mi-institucion';
```

## Si todavía aparece CORS

- Verifica `http://localhost:8000/health`.
- Comprueba `ALLOWED_ORIGINS=http://localhost:5173` en `apps/api/.env`, sin comillas innecesarias ni barras finales. Si Vite está usando otro puerto, inclúyelo explícitamente como origen separado por coma.
- Reinicia el proceso FastAPI después de modificar `.env`.
- Revisa la terminal de FastAPI: un error SQL no controlado puede aparecer como CORS, aunque el origen esté correctamente permitido.
- Nunca uses `allow_origins=['*']` para resolver errores indiscriminadamente en producción.

## Verificaciones ejecutadas en el parche

- `pytest -q`: **11 pruebas correctas** (simuladas, sin conexión real a Supabase).
- Validación de expresión regular con Node.js (flag `v`): **correcta**.
- Transpilación de `App.tsx` y `OrganizationForm.tsx`: **sin errores de sintaxis**.
- Compilación completa con Vite/TypeScript y conexión real a Supabase: **pendientes en el equipo del usuario**.
