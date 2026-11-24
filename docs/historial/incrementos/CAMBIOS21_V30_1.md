# CAMBIOS 21 — v30.1: tareas y entregas textuales

**Base requerida:** CAMBIOS 20 v29.3.1 (`main`, commit de referencia `96ade6a`).

## Objetivo

Separar las actividades de entrega de las **evaluaciones oficiales**: v30.1 habilita tareas
por **oferta académica**, entrega de respuestas textuales y observaciones docentes, sin
escribir notas oficiales, alterar el histórico de `app.assessments` ni inferir calificaciones de IA.

## Flujo

1. El docente asignado o gestor institucional crea una tarea en borrador; título
   (3–180), instrucciones (10–10 000), fecha límite opcional y 1–10 intentos.
2. El docente publica la tarea, que deja de poder editarse. Una tarea publicada se puede cerrar.
3. Un estudiante **matriculado activo** puede enviar hasta los intentos autorizados,
   solo si el curso está publicado, la oferta está `open`, la tarea está `published`
   y el plazo no ha vencido.
4. El docente visualiza entregas en páginas de 10 y registra observaciones. Una entrega
   revisada es inmutable en esta primera etapa; el estudiante puede consultar sus intentos
   y su retroalimentación.
5. Las acciones escriben `app.audit_logs` sin incluir respuestas ni observaciones.

## Seguridad y consistencia

- Cada ruta FastAPI exige JWT, organización, oferta y rol/matrícula reales.
- `app.task_submissions` usa dos FKs compuestas con `(organization_id, offering_id)`:
  no se puede enlazar una tarea de una oferta con matrícula de otra.
- RLS activada y forzada en ambas tablas; acceso directo `anon` / `authenticated` revocado.
- Envío serializado con bloqueo de tarea y matrícula, número de intento único,
  validación final del plazo con `clock_timestamp()` de PostgreSQL.
- No se utiliza Storage ni nueva clave; los archivos entregados se implementarán en v30.2.
- Las notas oficiales, las rúbricas y los eventos de progreso quedan para v30.3.

## Archivos principales

- `database/migrations/011_course_tasks.sql`
- `apps/api/app/routers/course_tasks.py`
- `apps/web/src/modules/academic/CourseTasksPanel.tsx`
- `apps/web/src/modules/academic/courseTaskRules.ts`
- `apps/api/tests/test_cambios21_tasks_v30_1.py`
- `apps/web/tests/tasks-policy.test.cjs`
- `tools/verificacion/preflight_011_solo_lectura.sql`
- `tools/verificacion/postflight_011_solo_lectura.sql`

## Pruebas manuales

- Docente asignado: crear, editar borrador, publicar, cerrar; comprobar que las
  tareas aparecen exclusivamente en la oferta actual.
- Estudiante matriculado: ver solo tareas publicadas/cerradas, enviar respuesta,
  revisar historial. Verificar bloqueo tras número máximo de intentos o fecha límite.
- Docente: revisar una entrega; estudiante: ver la observación.
- Docente NO asignado y estudiante NO matriculado: FastAPI debe rechazar acceso.
- Verificar temas claro, oscuro y negro e idiomas español, inglés y portugués.

## Despliegue

1. Comprobar repositorio limpio; ejecutar instalador `--check`.
2. Respaldar PostgreSQL esquema `app`.
3. Ejecutar **preflight 011** (solo lectura).
4. Ejecutar **migración 011 UNA sola vez** en Supabase SQL Editor.
5. Ejecutar **postflight 011** (cuatro flags RLS `true`, orfandad 0).
6. Ejecutar instalador `--apply` (respaldo local automático).
7. Probar Ruff, Pytest, chequeo API, Vite, `npm run test:editor` y `npm run test:tasks`.
8. Hacer pruebas funcionales y **solo entonces** commit/push.

Nota: esta entrega no debe publicar notas oficiales ni habilitar subida de archivos.
