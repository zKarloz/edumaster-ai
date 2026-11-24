# CAMBIOS 20 — v29.1 / Revisión C: compatibilidad transaccional

**Estado: PREPARACIÓN / NO INSTALAR / NO EJECUTAR 009 EN PRODUCCIÓN.**

**Base de trabajo:** v28, commit GitHub `3895ed3`, más migración y servicios de la revisión B.
Los ZIP incluyen código preparatorio, pero el frontend Tiptap todavía no se ha integrado.

## Implementación incorporada

1. `lesson_revision_compat.py`: servicio transaccional para creaciones y cambios de
   lecciones institucionales y de oferta, sin mezclar sus permisos.
2. Creación heredada: `app.lessons` o `app.offering_lessons` y su revisión `draft`
   se insertan en la **misma transacción**, junto con auditoría.
3. Edición heredada: se sincronizan título/contenido de texto plano con su
   revisión `draft` bajo bloqueo de lección y revisión. Se incrementa
   `lock_version` para detectar conflictos con el nuevo editor.
4. Protección del contenido visible: una lección `published` no puede pasar
   directamente a `draft` ni sobrescribir su texto mediante los formularios
   heredados. Debe crear una revisión independiente.
5. El formulario heredado solo puede publicar un borrador `plain-text-v1`
   cuando no hay revisión publicada vigente; la publicación de Tiptap se
   reservará a v29.3. La publicación antigua asigna número y responsable de
   revisión en la misma transacción que cambia el estado visible.
6. Archivar oculta la lección sin borrar la publicación previa. Reactivar una
   lección archivada con estado `draft` crea un borrador cuando sea necesario,
   sin sobrescribir el historial.
7. Se han incluido las seis rutas `GET/POST/PATCH .../draft` en `app.main`.
   La aplicación no es desplegable hasta que 009 esté aplicada y probada.

## Regla principal de negocio

Cuando una lección está publicada, la API antigua **no tiene una opción
"despublicar para editar"**: al intentar `status=draft` devuelve 409.
El nuevo editor utiliza `POST .../draft`, lo que mantiene el contenido publicado
accesible para el estudiante y crea una revisión de trabajo separada.
El PATCH del nuevo editor modifica únicamente `app.lesson_revisions`, con
`expected_lock_version`, y preserva `lessons` / `offering_lessons`.

Al editar un borrador `tiptap-json-v1`, el PATCH antiguo de texto/título
recibe 409, sin alterar el documento. Las operaciones sobre estados se validan
para prevenir publicación de JSON sin su flujo versionado transaccional.

## Verificaciones realizadas

- **255 pruebas pytest superadas** en este entorno, incluidas 28 nuevas pruebas
  de compatibilidad y autorizaciones desde la revisión B.
- Sintaxis Python comprobada con `ast.parse` y `compileall`.
- Sin conexión a PostgreSQL/Supabase real, sin migración SQL aplicada.
- Ruff y compilación React no ejecutados en esta revisión (frontend sin cambios).

## Riesgos y condiciones antes de desplegar

- **MIGRACIÓN OBLIGATORIA:** activar backend C sobre esquema v28 sin
  `app.lesson_revisions` provocaría errores SQL. No hacer un despliegue parcial.
- Ejecutar primero 009 en **una base de pruebas separada**, con respaldo y
  consultas `009_preflight_lectura.sql` y `009_postflight_lectura.sql`.
- Comprobar los privilegios `SELECT/INSERT/UPDATE` del rol real de la API:
  `rolbypassrls=True` ya se verificó en la conexión del usuario, pero no basta
  para probar los permisos sobre la nueva tabla.
- Probar la secuencia real `crear → guardar → publicar texto plano → archivar →
  reactivar` y que un estudiante siga viendo el contenido publicado mientras
  un gestor/doncente guarda una nueva revisión Tiptap.
- Probar dos instituciones, docentes de ofertas ajenas y conflictos de
  concurrencia reales antes de instalar y publicar.
- Al desplegar, bloquear temporalmente las escrituras de Cursos, ejecutar 009,
  desplegar backend actualizado y habilitar nuevamente las escrituras en una
  ventana de mantenimiento coordinada. El frontend Tiptap llegará en la
  siguiente etapa, antes de preparar un instalador final v29.1.

## Próxima etapa

Integrar Tiptap con React y el diseño actual, incorporar la página interna
`LessonEditorPage`, entrada desde `CourseWorkspacePage`, traducciones, temas y
confirmación al salir sin guardar. Después, validación real con PostgreSQL,
revisión de SQL y paquetes completos/incrementales instalables.
