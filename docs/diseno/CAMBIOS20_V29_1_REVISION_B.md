# CAMBIOS 20 — v29.1 / Revisión B: migración 009 y endpoints

**Estado:** código de preparación. **NO aplicar migración ni instalar sobre v28.**

## Cambios respecto a la Etapa A

1. `009_lesson_revisions.sql`: FK triples para impedir referencias `base_revision_id` entre lecciones distintas de una misma institución; protección contra referencia a sí misma.
2. Backfill: se conserva `content` y se registra `legacy_content_was_null` para distinguir explícitamente los registros originalmente `NULL` de los vacíos.
3. `009_preflight_lectura.sql`: añade comprobación del rol SQL, existencia previa de la tabla 009 y recuento de `NULL`.
4. `009_postflight_lectura.sql`: añade una comprobación de referencias entre lecciones; el valor esperado es cero.
5. `app/routers/lesson_revisions.py`: seis endpoints de borrador preparados para ambas procedencias; **aún no se incluyen en `app.main`**, por seguridad.
6. `tests/test_cambios20_draft_routes_v29_1.py`: ocho pruebas con conexión SQL simulada, añadidas a las 219 de la etapa A.

## Riesgos detectados y condición para activar las rutas

- **RLS y permisos reales:** FastAPI usa SQLAlchemy sobre `DATABASE_URL`. El SQL Editor de Supabase puede tener otro usuario. Comprobar desde la propia conexión del servidor que el rol tiene capacidad efectiva para operar sobre `app.lesson_revisions` con RLS forzada. No abrir políticas `anon` o `authenticated` como arreglo.
- **Compatibilidad v28:** los endpoints `PATCH /lessons/{lesson_id}` y `PATCH /offering-lessons/{lesson_id}` aún modifican directamente los registros de las lecciones. Antes de activar las rutas nuevas, adaptar la edición, la creación y las transiciones de estado en la misma transacción SQL para que nunca diverjan el registro público y la revisión. Mientras esto no esté resuelto, `app.main` no monta el router nuevo.
- **Prueba real:** las 227 pruebas Python no prueban PostgreSQL ni bloqueos reales. Ejecutar 009 primero en un entorno de prueba con respaldos, preflight y postflight; probar después dos editores concurrentes, dos instituciones, docentes de otras ofertas y RLS.
- **Proyección pública:** los métodos de borrador nunca cambian `app.lessons` ni `app.offering_lessons`; su publicación transaccional se implementará durante la integración, sin permitir que una lección publicada desaparezca por guardar el borrador.
- **Archivo y borradores:** `POST/PATCH` rechazan las lecciones archivadas. Las revisiones iniciales archivadas permanecen como `superseded` sin historial ficticio.

## Contratos implementados (no activos)

| Método | Lección institucional | Lección de oferta |
|---|---|---|
| GET | `/lessons/{lesson_id}/draft` | `/offering-lessons/{lesson_id}/draft` |
| POST | `/lessons/{lesson_id}/draft` | `/offering-lessons/{lesson_id}/draft` |
| PATCH | `/lessons/{lesson_id}/draft` | `/offering-lessons/{lesson_id}/draft` |

Prefijo: `/api/v1/academic/organizations/{organization_id}`. Requieren JWT, ámbito de institución, rol correspondiente y acceso autorizado a la lección. Se reutilizan las comprobaciones de `course_content.py` y `offering_content.py`.

`GET` devuelve borrador o 404; `POST` crea borrador desde la revisión publicada o 409 si ya existe; `PATCH` exige `expected_lock_version` y devuelve 409 si se modificó desde la lectura. Los registros de auditoría se escriben en la misma transacción. Un documento mal formado devuelve 422.

## Validaciones locales

- `python -m compileall -q app tests`: correcto.
- `python -m pytest -q`: **227 passed** (conexiones simuladas).
- Ruff: no disponible en este entorno; pendiente en Git Bash.
- Compilación Vite: no corresponde; frontend sin modificaciones.
- PostgreSQL/Supabase: **no conectado, SQL 009 no ejecutado**.

## Próximo trabajo inmediato

Adaptar y probar las rutas heredadas (creación, edición y cambios de estado), ejecutar verificación real de la migración en una base de ensayo y, cuando sean seguras todas las rutas, conectarlas a `app.main`. Después integraremos Tiptap y el frontend en la entrega funcional v29.1.
