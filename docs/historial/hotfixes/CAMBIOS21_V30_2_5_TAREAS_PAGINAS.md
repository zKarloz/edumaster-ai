# CAMBIOS 21 — v30.2.5 | Tareas como páginas y actualización desde navegador

**Base:** v30.2.4 (con la corrección manual opcional del import `CheckCircle2`).

## Cambios

1. Las tarjetas de `Actividades y tareas` son botones completos y abren `/academico/organizaciones/{org}/ofertas/{oferta}/tareas/{tarea}`.
2. El formulario de entrega está dentro de esa página, con archivos pendientes e historial privado; desaparece el botón `Mis entregas` del catálogo. `Enviar entrega` queda a la derecha y muestra el formulario en línea. La ruta antigua `/mis-entregas` sigue funcionando como alias.
3. La creación y edición docente de una tarea se hacen en página; publicar y cerrar usan confirmación en línea, sin modal. Las revisiones docentes conservan sus páginas separadas.
4. Se retiran los botones manuales `Actualizar` de Instituciones, Usuarios, Cursos, Estudiantes, Matrículas, Actividad, Tareas y listas de entregas. Se conservan las actualizaciones **automáticas tras guardar/enviar**. También se conserva `Reintentar` en estados de error, `Probar API` en Configuración y la recuperación explícita de conflictos de borrador en el editor de lecciones: no son botones genéricos de Actualizar.
5. Las pestañas internas usan el color del curso oscurecido ligeramente (`color-mix` con negro), sin perder contraste ni scroll horizontal. El modo Negro continúa monocromático.

## Seguridad

- El frontend nunca autoriza con los UUID de la ruta. FastAPI valida JWT, organización, matrícula, oferta, estado de tarea, límite de intentos y plazo en cada solicitud.
- Alumnos solo consultan `/my-submissions`, docentes la lista autorizada de la oferta. Adjuntos permanecen privados y sus descargas se firman bajo demanda.
- No hay migración SQL, cambios de credenciales ni dependencia nueva.

## Validación recomendada

- `python -m ruff check app tests && python -m pytest -q` desde `apps/api`.
- `npm run build && npm run test:editor && npm run test:tasks` desde `apps/web`.
- Comprobar card→detalle→envío, crear/publicar/cerrar tarea, roles, enlaces antiguos y los tres temas. No hacer commit hasta validar el build de Windows.
