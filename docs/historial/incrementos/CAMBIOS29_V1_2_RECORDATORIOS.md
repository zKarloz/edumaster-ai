# CAMBIOS 29 v1.2 — Recordatorios y avisos de gestión

Aplicar 021_notification_reminders.sql después de 019 y 020, antes de desplegar el backend y el frontend. No hay dependencias nuevas. El nuevo POST /api/v1/notifications/refresh materializa recordatorios del JWT autenticado y consulta la bandeja; GET sigue disponible para lectura. No se requiere cron, correo ni Realtime.

- Estudiante: tarea publicada sin entregas, matrícula activa, oferta abierta y vencimiento futuro dentro de 48 horas, según el reloj de PostgreSQL. El aviso deja de verse al entregar, vencer o perder acceso.
- Docente asignado: una alerta por tarea con alguna matrícula con entrega y sin nota oficial vigente. Se abre el listado de entregas. Desaparece al quedar todas calificadas o perder acceso.
- Administrador institucional y coordinador: nueva matrícula de su institución, excepto el autor de la acción; se abre su historial académico.
- Docente: nueva asignación, a partir de la auditoría de la acción, excepto si coincide con el autor; se abre la oferta. Una nueva acción auditada de asignación genera otro aviso, incluso si reafirma la misma asignación.

Los recordatorios tienen actor_id NULL (evento automático). Los avisos administrativos nacen en la transacción de auditoría, sin backfill. La clave única evita duplicar recordatorios por usuario, tipo y tarea, incluidos los ya leídos. Si aparecen nuevas entregas después de marcar el recordatorio como leído, se mantienen los avisos individuales de entrega de v1.1; no se rearma el recordatorio. Los avisos resueltos se ocultan, no se eliminan. No se modifica el intervalo de 60 segundos ni el máximo de 50 registros visibles. Las notificaciones administrativas son para los gestores institucionales, no se amplían a superadmin, seguridad o ingresos.

Validación: ejecutar Ruff, pytest, pruebas Node y build. Probar tarea que vence hoy (hora de Lima), tarea que vence en más de 48 h, entrega, calificación, nueva matrícula por otro gestor, asignación de docente y cambio de permisos. Comprobar que dos actualizaciones no generan duplicados. Las pruebas de contrato no ejecutan PostgreSQL ni verifican el navegador.
