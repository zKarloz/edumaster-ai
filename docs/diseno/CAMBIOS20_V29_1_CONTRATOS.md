# CAMBIOS 20 · v29.1 — Diseño de revisiones y contratos API

**Estado:** revisión técnica B, migración corregida y rutas preparadas SIN ACTIVAR. **No desplegar esta preparación ni ejecutar la migración 009 todavía.**  
**Base:** proyecto v28, commit `3895ed3` proporcionado en el registro de GitHub.  
**Referencias:** Documentación EduMaster Enterprise, §4.3 y §7.2; Manual Enterprise, §4.3 y §11.1.

## 1. Política funcional aprobada

- Una lección publicada conserva la revisión que ven los estudiantes mientras un editor autorizado prepara un borrador independiente.
- Cada lección tiene **como máximo una** revisión publicada vigente y **como máximo un** borrador editable. Las revisiones anteriores podrán persistir como `superseded`.
- Los materiales institucionales pertenecen a `app.lessons`; los de oferta, a `app.offering_lessons`. Nunca se intercambian sus permisos.
- Los gestores institucionales editan contenido de su institución; los docentes asignados, solo su contenido de oferta. La supervisión de los gestores se conserva.
- La confirmación de impacto sobre ofertas vinculadas se realizará cuando se implemente la publicación de revisiones institucionales (v29.3).
- Los archivos se almacenarán en bucket privado con relación a una revisión concreta (v29.2), no en la migración 009.

## 2. Compatibilidad imprescindible con v28

`app.lessons` y `app.offering_lessons` permanecen sin ALTER y sus columnas `title`, `content` y `status` continúan determinando el contenido que sirven los endpoints de lectura de v28.

La migración 009 **solo crea una tabla**, índices, trigger de actualización, permisos restrictivos y una instantánea de cada lección existente. Durante la transacción bloquea temporalmente escrituras concurrentes sobre las dos tablas de lecciones para capturar datos coherentes; requiere una ventana breve de mantenimiento. No reescribe contenido publicado ni cambia los estados de las lecciones.

La instantánea histórica inicial usa `plain-text-v1`, conserva el texto anterior y registra expresamente si `content` era `NULL`. FastAPI hará una conversión de presentación a documento Tiptap al abrir un borrador; el texto almacenado original no se reinterpreta como HTML ni se elimina.

Un registro anterior con estado `archived` se conserva como `superseded` sin número de versión, **no** como publicación histórica inventada. En lecciones publicadas `revision_number=1` significa *primer punto de control documentado*, no primera publicación real. `published_at` y `published_by` quedan nulos al no existir evidencia histórica.

## 3. Entidades de la migración 009

`app.lesson_revisions` contiene identificadores `organization_id` e `id`, XOR entre `institutional_lesson_id` y `offering_lesson_id`, relación opcional `base_revision_id`, título, cuerpo de texto, formato, estado, número de revisión publicado, contador de bloqueo, procedencia y trazabilidad de usuarios y fechas.

Estados: `draft`, `published`, `superseded`. Formatos: `plain-text-v1` y `tiptap-json-v1`. Procedencia: `legacy`, `editor`, `restored`.

Las claves foráneas compuestas `(organization_id, parent_id)` mantienen la separación multiinstitucional. La referencia opcional `base_revision_id` se valida además mediante claves triples: debe corresponder a una revisión de **esa misma lección**, incluso si otra lección pertenece a la misma institución. El indicador `legacy_content_was_null` conserva el caso original `content IS NULL` sin confundirlo con texto vacío. Índices únicos parciales garantizan el máximo de un borrador y una publicación por lección, incluso con operaciones concurrentes.

**Seguridad:** RLS habilitada y forzada, sin políticas abiertas para `anon` o `authenticated`. No se conceden permisos directos a clientes. Antes de ejecutar 009 se comprobará que el usuario PostgreSQL privado de FastAPI puede operar en el esquema `app` con la política vigente (con `FORCE ROW LEVEL SECURITY` y sin políticas, se requiere un rol servidor con capacidad efectiva de saltar RLS) (el repositorio actual usa el mismo patrón de acceso para las tablas existentes).

## 4. Contratos previstos de FastAPI

Prefijo común: `/api/v1/academic/organizations/{organization_id}`. Los UUID se validarán por tipo, JWT obligatorio. La autoridad se calcula en el servidor en cada llamada; la ruta no otorga permisos por sí misma.

| Método | Ruta relativa | Resultado | Autorización |
| --- | --- | --- | --- |
| `GET` | `/lessons/{lesson_id}/draft` | 200 borrador / 404 inexistente | Gestor institucional |
| `POST` | `/lessons/{lesson_id}/draft` | 201 crea borrador a partir de publicación / 409 ya existe | Gestor institucional |
| `PATCH` | `/lessons/{lesson_id}/draft` | 200 guarda borrador / 409 conflicto de versión | Gestor institucional |
| `GET` | `/offering-lessons/{lesson_id}/draft` | 200 borrador / 404 inexistente | Gestor o docente de oferta |
| `POST` | `/offering-lessons/{lesson_id}/draft` | 201 nuevo borrador / 409 ya existe | Gestor o docente de oferta |
| `PATCH` | `/offering-lessons/{lesson_id}/draft` | 200 guardado / 409 conflicto de versión | Gestor o docente de oferta |

La lectura y publicación para estudiantes **no utilizarán estas rutas**. Seguirán consumiendo solamente el contenido vigente publicado desde el workspace autorizado. En v29.1 todavía **no** habrá endpoint de publicación de revisión enriquecida.

**Respuesta de GET/PATCH (ejemplo conceptual):**

```json
{
  "id": "99999999-9999-4999-8999-999999999999",
  "lesson_id": "88888888-8888-4888-8888-888888888888",
  "source": "offering",
  "revision_state": "draft",
  "title": "Introducción a las ecuaciones",
  "document_format": "tiptap-json-v1",
  "document": {
    "type": "doc",
    "content": [
      {"type":"paragraph","content":[{"type":"text","text":"Comencemos."}]}
    ]
  },
  "lock_version": 2,
  "base_revision_id": null,
  "updated_at": "2026-11-23T20:00:00Z"
}
```

**PATCH (el cliente debe enviar la versión exacta que leyó):**

```json
{
  "title": "Introducción a las ecuaciones",
  "document": {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Comencemos."}]}]},
  "expected_lock_version": 2
}
```

**Errores:** 401 sin sesión, 403 sin autorización, 404 lección o borrador no encontrado (sin filtrar datos ajenos), 409 edición concurrente, estado incompatible o borrador ya existente, 422 documento no válido, 503 indisponibilidad de datos. Un conflicto NO actualiza contenido.

## 5. Concurrencia y transacciones

Una escritura debe:

1. Validar identidad, institución y asignación/rol antes de leer contenidos privados.
2. Abrir transacción en PostgreSQL y bloquear el registro de la lección cuando proceda.
3. Comprobar `expected_lock_version` dentro de la misma transacción.
4. Actualizar solo la revisión `draft`, incrementando `lock_version` exactamente una vez.
5. Registrar `app.audit_logs` en la misma transacción y devolver el nuevo contador.

En ningún paso de `PATCH /draft` se actualizarán `lessons.title`, `lessons.content`, `offering_lessons.title`, `offering_lessons.content` ni sus estados.

## 6. Compatibilidad de los endpoints antiguos: condición de despliegue

La nueva API **no debe habilitarse para uso general** hasta actualizar los endpoints heredados `PATCH /lessons/{id}` y `PATCH /offering-lessons/{id}` y sus flujos de creación. De lo contrario, los formularios antiguos podrían cambiar el contenido publicado sin sincronizar la revisión nueva.

Política de transición prevista:

- Creaciones de lección: insertar en `app.lessons` o `app.offering_lessons` **y** crear el borrador inicial dentro de la misma transacción.
- Ediciones de texto plano en un borrador heredado: sincronizar la revisión `draft` en esa misma transacción o rechazarlas con 409 y mostrar el editor nuevo. No permitir escrituras que dejen los dos registros divergentes.
- Cambios `published → draft` de una lección publicada: **bloquearlos** en la API antigua para mantener la versión pública hasta que exista una publicación transaccional versionada.
- Archivado de una lección: no borra la revisión; oculta el contenido por la regla de visibilidad preexistente.
- Transiciones a `published` desde el flujo heredado: adaptar su ruta para actualizar coherentemente la revisión inicial, o restringir temporalmente la publicación desde la interfaz mientras se introduce la operación versionada. No permitir una publicación parcial.

Esta compatibilidad será implementada y probada **antes** de entregar el instalador funcional v29.1.

## 7. Validación documental

`app/services/lesson_documents.py` implementa la primera pieza reutilizable: validación estricta de Tiptap, conversión de texto plano, control del tamaño y rechazo de nodos HTML/iframe/image, formatos no aprobados y enlaces no HTTPS. **No** pretende sustituir la autorización SQL de la API.

Nodos permitidos por el contrato inicial: `doc`, `paragraph`, `text`, `heading` (niveles 1–3), `bulletList`, `orderedList`, `listItem`, `blockquote`, `hardBreak`. Marcas: `bold`, `italic`, `underline`, `link` HTTPS. Formatos adicionales de Tiptap deberán deshabilitarse en el frontend o definirse y probarse antes de su uso.

## 8. Verificaciones obligatorias antes de ejecutar 009

- Ejecutar las consultas **solo lectura** `009_preflight_lectura.sql` y guardar los resultados.
- Obtener respaldo verificable de las tablas `app.lessons`, `app.offering_lessons` y las relaciones académicas, según el procedimiento de backup del proyecto.
- Revisar la función `app.touch_updated_at()` y los permisos del rol servidor.
- Validar el plan de vuelta atrás: si la migración falla antes de COMMIT, PostgreSQL revierte la transacción; una migración ya aplicada no se elimina mientras la API dependa de ella.
- Probar 009 en un entorno de prueba separado antes de producción, con datos equivalentes a la institución real.
- Tras ejecutar 009, revisar `009_postflight_lectura.sql`: conteos, tenant, integridad, RLS, estado y duplicados.

## 9. Próximas etapas de v29.1

**Etapa A:** migración 009 redactada, DTO y validador creados, tests unitarios y contratos revisados.

**Etapa B (esta revisión):** migración con FKs de misma lección y metadatos de NULL, seis rutas de borrador implementadas y probadas con conexiones simuladas, pero **NO registradas en `app.main`**. Falta una prueba de integración con PostgreSQL real y completar la compatibilidad de rutas heredadas.

**Etapa B (pendiente para su cierre):** adaptación de las rutas heredadas de creación, estado y contenido y pruebas reales de autorización y transacciones.

**Etapa C:** componentes React con Tiptap, página interna, navegación, estados de guardado, traducciones, temas, tests de integración y ZIP incremental/total listo para instalar.

El trabajo en la siguiente etapa debe comenzar sobre el commit v28 confirmado y revisar diferencias reales de la copia local antes de instalar.

## 10. Estado de implementación de la Revisión C (no desplegado)

- Se ha añadido `app/services/lesson_revision_compat.py`, que inserta una
  revisión inicial en la misma transacción al crear una lección y sincroniza
  el `PATCH` heredado mientras su revisión sea `plain-text-v1`.
- Se han actualizado `course_content.py` y `offering_content.py` para respetar
  ese puente, y `app.main` registra las seis rutas de borrador.
- **`published → draft` se rechaza con 409** por la regla de versión publicada
  vigente. El editor tendrá que usar `POST .../draft` para preparar cambios.
- La publicación desde el formulario heredado se permite **solo** si aún no
  existe versión publicada y el borrador es de texto plano. Publicar JSON
  Tiptap continuará reservado para v29.3.
- Al archivar se conserva la revisión; al reactivar una lección archivada se
  utiliza la revisión previa o se crea un borrador nuevo sin borrar historial.
- El guardado de un borrador Tiptap no actualiza `lessons.content` ni
  `offering_lessons.content`. Los editores heredados ya no pueden sobrescribirlo.
- Los archivos de esta revisión NO deben copiarse sobre v28 antes de aplicar
  `009` a un entorno de prueba y validar permisos y operaciones reales.
