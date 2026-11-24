# CAMBIOS 20 — v29.2 · Recursos académicos privados

**Base:** v29.1.1 (editor de lecciones con barra de formato corregida).
**Alcance:** adjuntos PDF/imágenes y enlaces externos HTTPS en borradores de revisiones.
**Migración:** `010_lesson_resources.sql` (aditiva; no borra lecciones ni revisiones).
**Almacenamiento:** bucket **privado** `course-resources`, hasta 10 MB por objeto y 30 recursos por borrador.

## Flujo

1. Un gestor institucional o un docente asignado abre el editor de una lección que puede gestionar.
2. Se listan los recursos vinculados al **borrador** autorizado, nunca un borrador de otra institución.
3. Un enlace se guarda como metadato en `app.lesson_revision_resources`, sin que el servidor visite el destino.
4. Los archivos PDF/PNG/JPEG/WebP pasan por FastAPI. Se restringen tipos, tamaño (10 MB) y firmas binarias; el objeto se envía a Supabase Storage mediante una **clave secreta solo de servidor**.
5. Una descarga se autoriza nuevamente en FastAPI y utiliza una URL de Storage firmada que vence a los 60 segundos.
6. Retirar un recurso lo desvincula del borrador, sin borrar inmediatamente el objeto histórico. Los objetos huérfanos se administrarán mediante una tarea de limpieza con período de retención.

**Publicación:** los recursos adjuntos en v29.2 no se muestran a estudiantes. v29.3 incorporará la promoción transaccional de revisiones y la asociación de recursos con la versión publicada.

## Protección por capas

- Las tablas tienen RLS **habilitada y forzada**, sin privilegios para `anon` ni `authenticated`. FastAPI comprueba el JWT y el rol en cada petición.
- La clave `SUPABASE_SECRET_KEY=sb_secret_...` se guarda **solo** en `apps/api/.env` o variables de entorno de Render, nunca en `VITE_*`, el navegador ni Git.
- Storage usa un bucket privado con formatos y tamaños restringidos. La migración crea el bucket cuando todavía no existe.
- Solo se acepta HTTPS para enlaces externos. El servidor no descarga ni inspecciona URLs proporcionadas por usuarios.
- Las descargas por URL firmada dejan de ser privadas para quien tenga el enlace **durante los 60 segundos de vigencia**. Evitar compartir estos enlaces.
- Se registran auditorías de adición y retirada de recursos.

## Limitaciones honestas de esta etapa

- La verificación de la firma del archivo **no equivale a un escaneo antimalware**. Se debe agregar un servicio de análisis de archivos antes de utilizar el módulo para cargas de terceros en producción abierta. Los PDF se presentan como adjuntos, no se convierten a HTML.
- Storage y PostgreSQL no comparten una única transacción. Se intenta limpiar el objeto si falla el registro SQL; un mantenedor deberá gestionar huérfanos si se producen fallos de red.
- No se incorporan videos, DOCX, archivos ejecutables, HTML incrustado, OCR ni previsualizaciones remotas.
- El respaldo PostgreSQL del esquema `app` **no incluye los bytes de Supabase Storage**. Para futuras copias de seguridad, se necesitará exportar también los objetos privados.
- El frontend y la API se han probado con pruebas automatizadas y sintaxis; la carga real y el build completo deben comprobarse en el VSCode del proyecto.

## QA recomendado

1. Comprobar SQL 010: dos tablas nuevas, bucket privado y RLS.
2. Configurar la clave secreta exclusivamente en FastAPI y reiniciar el servidor.
3. Coordinador: añadir un enlace HTTPS y cargar un PDF de prueba menor que 10 MB.
4. Descargar desde la API, abrir la vista previa y retirar el recurso.
5. Docente asignado: comprobar sus recursos de oferta; denegar acceso a otra oferta/institución.
6. Estudiante: comprobar que no aparecen recursos de borrador ni puede llamar a las rutas privadas.
7. Revisar Claro/Oscuro/Negro, ES/EN/PT y pantalla móvil.
8. Ruff, pytest, npm build, test:editor y diff de Git sin credenciales.
