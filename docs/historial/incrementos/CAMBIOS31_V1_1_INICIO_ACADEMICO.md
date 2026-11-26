# CAMBIOS 31 v1.1 — Inicio académico

Requiere CAMBIOS 31 v1.0 y migraciones anteriores hasta 021. No añade tablas ni dependencias. Desplegar backend y frontend juntos.

- Docente: hasta 200 ofertas propias consultadas (seis tarjetas), matrículas activas sumadas por oferta, tareas con entregas pendientes de calificación oficial. No son estudiantes únicos ni número de entregas.
- Estudiante: ofertas vigentes de matrículas propias, progreso registrado en `progress_snapshots` (null si no hay registro), tareas pendientes con vencimiento en 48 horas, recomendaciones pendientes de hasta seis ofertas y 200 recomendaciones por oferta.
- Pendientes: consulta privada de la vista `notification_reminder_events` de la migración 021, independiente de si el usuario leyó el aviso. Hasta 200 registros consultados, seis mostrados. No genera notificaciones adicionales.
- Filtros `own=true` en ofertas docentes y recomendaciones evitan heredar el alcance de gestor al consultar una vista personal. Los enlaces usan las rutas existentes y no cambian autorizaciones.
- Tarjetas de curso reutilizan icono/color configurados; no representan portadas fotográficas ni inferencias de IA. Continuar abre Contenido, no una última lección inferida.
- Se conservan los dashboards administrativos, temas, idiomas y selector multirrol. Las estadísticas faltantes quedan en guiones o estados vacíos. No se incluyen aún evolución de entregas, totales de intentos, progreso promedio global ni feed de Comunidad.

## Verificación
- Backend: `python -m pytest -q`: 437 aprobadas (conexiones simuladas).
- Frontend: `node --test tests/*.test.cjs`: 162 aprobadas. Sintaxis de tres TSX comprobada mediante TypeScript transpileModule.
- `python -m ruff check app tests`: no disponible Ruff en entorno de revisión.
- `npm run build`: bloqueado por dependencias npm ausentes. Pendiente validación visual y consultas reales en Supabase.

Aplicar sobre raíz, ejecutar Ruff, pytest, pruebas frontend y build; comprobar docentes, estudiantes y cambio multirrol antes del commit a main.
