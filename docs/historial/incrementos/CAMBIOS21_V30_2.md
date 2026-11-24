# CAMBIOS 21 · v30.2 — Adjuntos privados en entregas académicas

**Base requerida:** `main` commit `20ac55b` (v30.1.1). **Migración:** `012_task_submission_files.sql` (una sola vez).

## Experiencia

1. El estudiante matriculado abre una tarea publicada y puede **preparar** hasta 3 adjuntos PDF, PNG, JPG o WebP de como máximo **10 MiB** por archivo.
2. La validación ocurre en FastAPI, antes de enviar a Supabase Storage, y se repite al registrar los metadatos. Los archivos pendientes siguen asociados a su organización, oferta, tarea y matrícula.
3. Al pulsar **Enviar entrega**, se permite texto, archivos o ambos. En una sola transacción se registra el intento y se vinculan los adjuntos pendientes; si la entrega falla por fecha límite o intentos, los archivos permanecen pendientes.
4. El estudiante ve los archivos de sus intentos. El docente asignado los ve al revisar las entregas. Las descargas solo obtienen una URL firmada durante **60 segundos**, previa autorización de FastAPI.
5. Los archivos pendientes se pueden retirar, incluso si después vence el plazo; los que ya pertenecen a una entrega no se pueden modificar desde la interfaz.

## Seguridad

- Se reutiliza el bucket privado `course-resources` y `SUPABASE_SECRET_KEY` del backend. No se añaden secretos ni políticas públicas.
- `app.task_submission_files` incorpora FKs compuestas a la matrícula, la tarea y el intento; no permite referencias cruzadas entre ofertas ni instituciones.
- RLS activada y forzada, sin permisos directos para `anon` y `authenticated`.
- Firma binaria, límite por archivo, validación de tipo y nombre ya implementados en `course_resources.py`. El filtro de PDF no sustituye un análisis antivirus; para producción con usuarios no confiables debe incorporarse escaneo antimalware, límites de tráfico y retención.
- No se alteran calificaciones oficiales, rúbricas ni los registros antiguos de las entregas.
- El retiro de pendientes elimina la asociación SQL y **solicita** la eliminación del objeto. Si Storage no responde, puede quedar un archivo huérfano que deberá limpiarse mediante un trabajo posterior de retención.

## Instalación

1. Partir de `20ac55b` con árbol Git limpio; ejecutar `--check` del instalador.
2. Respaldar **esquema `app` con datos** mediante `pg_dump` como en 009/011.
3. Ejecutar **preflight 012** de solo lectura en Supabase SQL Editor y comprobar los valores esperados.
4. Ejecutar **migración 012** una sola vez; debe finalizar con `Success`.
5. Ejecutar **postflight 012**, verificar RLS verdadera/forzada, bucket privado y referencias cruzadas 0.
6. Aplicar el instalador con `--apply`, que respalda los archivos antes de sustituirlos.
7. Ruff, Pytest, verificador API, compilación frontend y pruebas de editor/tareas; después probar con matrículas de prueba.
8. Solo con todo validado: `git add -A`, `git diff --cached --check`, commit y push a `main`.

## Pruebas funcionales

- Estudiante: subir un PDF ficticio y una imagen, retirar una carga pendiente, enviar respuesta **solo con archivo**, ver y descargar sus adjuntos tras el envío.
- Docente asignado: abrir entrega, consultar los archivos y añadir observaciones; no editar los adjuntos ya enviados.
- Docente de otra oferta y estudiante de otra matrícula: acceso denegado por backend aunque conozcan UUIDs.
- Cerrar tarea o agotar intentos: no se permiten nuevas subidas ni envíos.
- Vencimiento entre carga y envío: backend rechaza entrega y mantiene pendientes para retiro.
- Temas claro, oscuro, negro; idiomas español, inglés, portugués.

**Pendiente de futuras mejoras:** escaneo antivirus real y limpieza periódica de archivos pendientes antiguos (retención). Este incremento no debe activarse para cargas de estudiantes no confiables en producción sin esas salvaguardas.
