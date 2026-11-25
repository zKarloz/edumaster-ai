# CAMBIOS 22 · v30.3.1 — Confirmación de entregas y acceso directo a la calificación

## Alcance

- Estudiantes: el formulario de envío **abre un modal de confirmación** antes de ejecutar `POST /submissions`. Cancelar no registra ni consume un intento, ni elimina los archivos ya adjuntos. El servidor sigue verificando plazo, matrícula, estado e intentos disponibles.
- Docentes: en la tabla de entregas de una tarea **cerrada** aparece `Calificar con rúbrica` para el **último intento revisado**. Si ya existe nota, el acceso dice `Rectificar nota`. El enlace abre la revisión individual directamente en la sección `Calificación oficial`.
- Página `Revisar entrega`: botón visible de `Calificar con rúbrica`, habilitado solo cuando la tarea está cerrada, la revisión guardada y el intento es el último. Si se bloquea, se explica el motivo. El bloque de calificación y sus criterios usan el panel compartido `TaskGradePanel`.
- FastAPI: listado de entregas incluye `is_latest_attempt` calculado en la consulta autorizada; no se hace una consulta adicional ni se revelan datos de otros alumnos.
- Corrección menor de estilo en el test Python original de v30.3 (`Decimal(17)` etc.) para Ruff moderno.

## Seguridad y flujo

1. El estudiante redacta o adjunta archivos, pulsa `Enviar entrega`, revisa la confirmación y elige `Confirmar envío`. El POST solo ocurre tras confirmar.
2. El docente configura la rúbrica en la tarea. Después de publicarla, el estudiante envía su trabajo.
3. El docente cierra la tarea y guarda la revisión del **último intento**. Entonces aparece el acceso directo a calificar desde la tabla y desde la revisión.
4. El docente introduce los puntajes por criterio y confirma el registro de la nota oficial en el modal existente. El backend aplica la migración 013 y mantiene los permisos y la unicidad.

## Instalación

Base requerida: **v30.3 instalada y migración SQL 013 ya aplicada**. El paquete es únicamente un hotfix de frontend y consulta de backend. **No incluye migraciones** nuevas ni dependencias. Aplicar `--check` antes de `--apply` y después comprobar las pruebas y el flujo real en el navegador.

Pruebas automáticas: `python -m pytest -q` en `apps/api`; `npm run test:tasks`, `npm run test:editor`, `npm run test:users` en `apps/web`. Validaciones adicionales en VSCode: `python -m ruff check app tests` y `npm run build`.

La nueva confirmación de entrega no sustituye el modal de confirmación de **guardar o rectificar una calificación**, que sigue siendo obligatorio.
