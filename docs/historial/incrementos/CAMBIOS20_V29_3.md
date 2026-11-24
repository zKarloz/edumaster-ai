# CAMBIOS 20 · v29.3 — Publicación versionada e historial

**Base:** v29.2.1, validada y publicada por el usuario en GitHub. **Fecha de preparación:** noviembre de 2026.

## Alcance funcional

- Publicar la revisión `draft` guardada en el editor Tiptap, conservando la versión anteriormente publicada como `superseded`.
- Transacción única para actualización de revisión, proyección heredada (`app.lessons` / `app.offering_lessons`) y bitácora institucional.
- Control de concurrencia mediante `expected_lock_version`: si cambió el borrador, responde 409 y no sobrescribe el trabajo ajeno.
- Historial paginado, con número, estado, título, responsable conocido y fecha de publicación disponible.
- Consultar el documento de una revisión histórica y **restaurar como un nuevo borrador**. Si existe un borrador previo, se exige confirmación expresa y coincidencia de ID + versión antes de sustituirlo. Nunca altera inmediatamente lo publicado.
- Las asociaciones de archivos y enlaces de la versión anterior se copian al nuevo borrador o al restaurado; los objetos privados de Storage no se sobrescriben.
- Coordinador/administrador institucional: advertencia con cantidad de ofertas vinculadas antes de publicar. La API vuelve a comprobar el número en la transacción.
- Lectura publicada para estudiantes con matrícula válida en una oferta (también para docentes asignados y gestores). Los gestores pueden abrir también la versión rica desde el curso institucional sin entrar a una oferta. Requiere publicación de **curso + unidad + lección** para estudiantes, sin exponer `draft` ni `superseded`.
- Recursos publicados: se listan con el documento vigente y las descargas usan enlaces firmados de 60 segundos tras la autorización de FastAPI.

## Modelo y seguridad

Se reutilizan las migraciones **009** y **010** que ya están aplicadas. **No ejecutar una migración 011.**

Las tablas `app.lesson_revisions`, `app.resource_files` y `app.lesson_revision_resources` siguen siendo privadas. El servicio FastAPI valida organización, rol y asignación docente o matrícula; no se otorga acceso directo a `anon` ni a `authenticated`.

Las revisiones anteriores son inmutables para usuarios normales, aunque el responsable autorizado pueda restaurar cualquiera de ellas como un nuevo borrador. Restaurar un borrador de trabajo crea otro registro y conserva las referencias históricas de recursos. Si hay un borrador activo, su sustitución requiere confirmación y se registra en la auditoría.

La proyección textual heredada no contiene HTML; la representación rica se sirve desde el endpoint publicado con el documento Tiptap validado. El lector lo renderiza en modo solo lectura.

## Contratos nuevos

Prefijo común: `/api/v1/academic/organizations/{organization_id}`.

| Método | Sufijo | Permisos |
|---|---|---|
| GET | `/lessons/{id}/impact` y `/offering-lessons/{id}/impact` | Gestor / editor autorizado |
| POST | `/lessons/{id}/publish` y `/offering-lessons/{id}/publish` | Gestor / editor autorizado |
| GET | `/lessons/{id}/history` y `/offering-lessons/{id}/history` | Gestor / editor autorizado |
| GET | `/lessons/{id}/revisions/{revision_id}` y equivalente de oferta | Gestor / editor autorizado |
| POST | `/lessons/{id}/revisions/{revision_id}/restore` y equivalente | Gestor / editor autorizado |
| GET | `/courses/{course_id}/published-lessons/{lesson_id}` | Solo gestor institucional autorizado |
| GET | `/courses/{course_id}/published-lessons/{lesson_id}/resources/{resource_id}/download` | Solo gestor institucional autorizado |
| GET | `/course-offerings/{offering_id}/published-lessons/{source}/{lesson_id}` | Gestor, docente asignado o estudiante matriculado |
| GET | `/course-offerings/{offering_id}/published-lessons/{source}/{lesson_id}/resources/{resource_id}/download` | Mismos permisos, recurso de revisión vigente |

Para `POST .../publish`, el cuerpo incluye `expected_lock_version`; en contenido institucional también `expected_affected_offerings`. No se publica un borrador que haya cambiado después de confirmarse.

Para restaurar se envía `expected_published_revision_id` y, si existe borrador de trabajo, `replace_draft_id` más `expected_draft_lock_version`. Cualquier desajuste devuelve 409 sin reemplazar el borrador.

## Instalación

1. Verificar que el proyecto tiene v29.2.1 y está limpio en Git, o revisar manualmente los cambios locales.
2. Ejecutar instalador en modo `--check`, después `--apply`; ambos mantienen CRLF y crean copia de los archivos sustituidos.
3. No hay SQL nuevo. Verificar privilegios mediante `python ../../tools/verificacion/verificar_publicacion_v29_3.py` desde `apps/api`.
4. Comprobar Ruff, pytest, `npm run build` y `npm run test:editor`.
5. Probar la secuencia coordinador → publicación institucional → estudiante matriculado; docente → publicación de oferta; restauración y conflictos concurrentes.
6. Registrar el commit y publicar en GitHub solo después de que esas pruebas sean satisfactorias.

## Pruebas y límites

El backend se ha probado con conexiones SQL simuladas; no sustituye una prueba transaccional de publicación real en Supabase. No se ejecutaron migraciones, ni se escribió en la BD del usuario desde la preparación. El build completo con dependencias React debe confirmarse en VSCode.

Esta entrega no implementa colaboración simultánea tipo Google Docs, comparación visual de diferencias entre dos revisiones, ni políticas por oferta para fijar versiones institucionales distintas. La publicación institucional actualiza el contenido compartido de las ofertas vinculadas.
