# EduMaster.ai · Incremento v16 — Matrículas y actividad académica

Este incremento es **real y transaccional**: no incorpora datos ficticios, resultados simulados ni predicciones de IA. Parte del proyecto v15.2 ya subido a GitHub y desplegado en Vercel/Render.

## Implementado

- **Matrículas**: botón de acciones en la tabla para cambiar entre *Activa*, *Retirada* y *Completada*; la matrícula completada es terminal. Una matrícula retirada únicamente se reactiva si la oferta está abierta y el estudiante, la membresía y la cuenta continúan activos.
- **Actividad académica**: módulo nuevo en el menú para administradores institucionales, coordinadores y docentes.
- **Ofertas docentes**: el gestor asigna/desasigna un docente activo a una oferta de la misma institución. El docente solo ve las ofertas asignadas.
- **Calificaciones**: guarda nota y nota máxima. Los promedios de la tabla muestran porcentajes normalizados; no constituyen notas finales oficiales.
- **Asistencia**: presente, tardanza, ausente y justificada. Las ausencias justificadas se excluyen del denominador de porcentaje. Se impiden duplicados de la misma sesión, fecha y matrícula.
- **Participación**: valoración de 1 a 5, registrada por sesión o actividad.
- **Progreso**: porcentaje de 0 a 100 guardado en `app.progress_snapshots` (tabla preexistente).
- **Auditoría**: altas, anulaciones y modificaciones de estado se auditan sin copiar nombres, notas ni observaciones a `app.audit_logs`. Las evidencias generan eventos mínimos en `app.learning_events`.
- **Corrección de errores**: los registros de nota/asistencia/participación pueden anularse mediante una operación registrada; no se borran físicamente.
- **Seguridad**: todas las consultas aplican organización y oferta; el rol global de superadministrador **no otorga permisos docentes** por sí solo. Solo se escribe actividad en matrículas activas.
- **Experiencia de usuario**: reutiliza `DataTable` paginada, `Modal`, `OptionSelect`, `Spinner`, notificaciones y estilos compatibles con Claro, Oscuro y Negro.

## Orden de instalación (muy importante por el despliegue automático)

1. Realiza una copia de seguridad de Supabase y **ejecuta primero** `database/migrations/005_academic_activity.sql` desde **Supabase → SQL Editor**. No vuelvas a ejecutar 001–004. La migración es aditiva, usa FK institucional y activa RLS en la nueva tabla.
2. Verifica la instalación:

   ```sql
   SELECT to_regclass('app.academic_activity_records') AS tabla;
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname='app' AND tablename='academic_activity_records';
   ```

   Esperado: tabla `app.academic_activity_records` y `rowsecurity = true`.
3. Descomprime el ZIP de parche **encima de tu `edumaster-ai` actual**. No sobrescribas `.env` y no incluyas credenciales en Git.
4. En Git Bash, desde `apps/api` con `.venv` activado:

   ```bash
   python -m ruff check app tests --fix
   python -m ruff check app tests
   python -m pytest -q
   ```

5. Desde `apps/web`:

   ```bash
   npm run build
   ```

6. Desde la raíz del repositorio:

   ```bash
   git add apps/api/app/main.py \
     apps/api/app/routers/academic_activity.py \
     apps/api/tests/test_academic_activity_v16.py \
     apps/web/src/App.tsx \
     apps/web/src/modules/academic/AcademicPage.tsx \
     apps/web/src/modules/academic/AcademicActivityPage.tsx \
     database/migrations/005_academic_activity.sql \
     LEEME_INCREMENTO_ACADEMICO_V16.md README.md
   git commit -m "feat(academico): ampliar matrículas y registrar actividad académica"
   git push origin main
   ```

7. Verifica **GitHub Actions** (api y web en verde). Los despliegues automáticos en Render y Vercel son posteriores al `git push`; no modifiques las URL ni las variables `VITE_*` o CORS existentes.

## Flujo de prueba recomendado

1. En **Usuarios** de una institución, asigna el rol **Estudiante** a una cuenta confirmada de Supabase. El perfil académico se crea automáticamente. Si ya tiene ese rol, no lo incorpores de nuevo desde Estudiantes.
2. Asigna el rol **Docente** a otra cuenta confirmada.
3. Desde **Matrículas**, matricula al estudiante en una oferta abierta.
4. Desde **Actividad académica** con un administrador/coordinador, selecciona la oferta y asigna el docente. Guarda la asignación.
5. Con la cuenta docente, abre **Actividad académica**: únicamente se mostrarán sus ofertas. Registra nota, asistencia, participación y progreso del estudiante.
6. Revisa los valores y el historial; prueba anular una evidencia errónea y registrarla correctamente.
7. Vuelve al administrador, cambia una matrícula a **Retirada** y verifica que ya no puedas añadir registros sobre ella. Si la oferta sigue abierta puedes reactivarla. **Completada** es definitiva.
8. Accede con una cuenta docente de otra institución: no debe consultar ni escribir evidencias de la oferta.

## Límites conocidos y siguientes hitos

- Este incremento cubre **registro y consulta de evidencias académicas**, no todavía evaluación formal con rúbricas, pesos, aprobación de notas, importación CSV ni portal de consulta de notas para alumnos.
- Las vistas consumen como máximo 200 ofertas, 500 matrículas por oferta y 500 evidencias por oferta; la tabla pagina localmente. Un uso masivo requerirá paginación del servidor.
- Las observaciones de actividad son datos personales: usa cuentas DEMO sin información sensible al evaluar el despliegue público.
- Las evidencias no generan mensajes ni recomendaciones automáticas. Un futuro módulo de IA deberá validar su calidad y requerirá revisión docente.
- El flujo SQL y el resultado visual aún deben probarse contra **tu Supabase y Vercel reales**. Las pruebas automatizadas utilizan sustitutos de la base y no reemplazan esas verificaciones.

## Archivos principales

- `database/migrations/005_academic_activity.sql`
- `apps/api/app/routers/academic_activity.py`
- `apps/api/tests/test_academic_activity_v16.py`
- `apps/api/app/main.py`
- `apps/web/src/modules/academic/AcademicActivityPage.tsx`
- `apps/web/src/modules/academic/AcademicPage.tsx`
- `apps/web/src/App.tsx`
