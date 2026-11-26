# CAMBIOS 29 v1.1 — Notificaciones académicas

Aplicar después de v1.0 y su hotfix, con migración 019 ya aplicada. Respaldar la base y ejecutar 020_academic_notifications.sql antes de desplegar el nuevo backend. La migración es transaccional y se ejecuta una vez. No borra avisos ni estados de lectura. No hay dependencias nuevas.

## Alcance

- Publicación de tarea: alumnos con matrícula activa y acceso al curso publicado. El autor real se registra en course_tasks.published_by.
- Entrega nueva: docente actualmente asignado, con rol y membresía activos. Abre listado de entregas de la tarea.
- Emisión inicial de nota oficial: alumno de la matrícula, sin incluir nota ni respuesta en el aviso. Abre tarea. Las rectificaciones quedan pendientes.
- Anuncio: alumnos con matrícula activa; pregunta: docente asignado; comentario: autor de publicación si sigue siendo docente asignado o alumno autorizado. No se envía aviso al propio autor del evento.
- Comunidad: apertura de la página de la publicación y sus comentarios, incluso si no está en la primera página.
- Se mantienen los avisos de recomendación, el intervalo de 60 s, contador, filtros, límite de 50 y lectura persistente.

## Seguridad y datos

La migración amplía restricciones de tipo y sustituye la FK específica de recomendaciones por referencias polimórficas verificadas mediante vistas de recursos actuales y triggers transaccionales. Las vistas y función no conceden acceso directo a anon/authenticated/PUBLIC. El backend filtra por identidad autenticada, destinatario, organización, recurso, tipo y acceso vigente. No se crean avisos retroactivos. El destinatario de la entrega es el docente asignado al momento del evento; si deja de estar asignado pierde visibilidad. No se notifican gestores por defecto ni se envían correos. Los anuncios y tareas requieren matrícula activa para generar el aviso; los alumnos que completaron una matrícula conservan visibilidad cuando el recurso sigue accesible.

## Pruebas

429 pruebas Python y 152 pruebas Node aprobadas; pruebas SQL con mocks. Transpilación de sintaxis TSX sin diagnósticos. Ruff no instalado. Build bloqueado por dependencias npm faltantes. No se ejecutó la migración contra PostgreSQL real. Validar antes de subir: migración, Ruff, pytest, npm run build, publicación de tarea, envío, nota, anuncio, pregunta, comentario, navegación, lectura y aislamiento entre instituciones. Si la migración falla, no desplegar; revisar error exacto. El backend nuevo requiere migración 020. Las tareas y publicaciones existentes no generan nuevos avisos salvo operaciones futuras que disparen un trigger.
