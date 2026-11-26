# CAMBIOS 24 — v1.0 · Recomendaciones docentes

Base: CAMBIOS 23 v31.7 y hotfixes de v31.6.3. No modifica el laboratorio neuronal.

## Instalación

1. Respaldar la base de datos; aplicar una vez `database/migrations/015_teacher_recommendations.sql` en Supabase SQL Editor después de la 014.
2. Desde `apps/api`, ejecutar `python -m ruff check app tests` y `python -m pytest -q`.
3. Desde `apps/web`, ejecutar `node --test tests/*.test.cjs` y `npm run build`.
4. Probar localmente con un docente asignado y un estudiante con matrícula activa, usando sus cuentas propias. Desplegar backend antes de probar frontend de producción.

## Alcance funcional

Dentro de Cursos → oferta → Recomendaciones. No aparece en curso base. El docente asignado o gestor institucional autorizado puede enviar una recomendación a una matrícula activa de la oferta. El estudiante matriculado solo puede leer las suyas y marcar una pendiente como completada. Las operaciones de envío y finalización generan auditoría en la misma transacción. No se modifican calificaciones, progreso ni certificaciones. El texto es orientación humana, no predicción de IA.

La API usa `_context`, `_editor` y `_student` de tareas, JWT, SQL parametrizado y filtros por institución/oferta/matrícula. RLS forzada y sin acceso directo de anon/authenticated. Los gestores institucionales pueden consultar todas las recomendaciones de su oferta. El superadmin no obtiene automáticamente permisos académicos operativos.

Límites iniciales: 200 recomendaciones recientes por oferta/consulta y 500 destinatarios activos; la tabla pagina localmente esos resultados. Pendientes: paginación remota, edición/retiro, enlaces directos a lecciones/tareas, alertas de recepción y recomendaciones automáticas. No se utiliza información sintética para rellenar listados.

## Aceptación

- Docente asignado: enviar una recomendación de prioridad alta, comprobar toast y recarga.
- Estudiante destinatario: ver texto, autor y estado, completar; comprobar toast y recarga.
- Docente: actualizar y comprobar estado completado.
- Otro estudiante: no debe ver la recomendación; otra oferta o institución no puede usar el ID para completarla.
- Verificar escritorio/móvil y Claro/Oscuro/Negro.
- Verificar auditoría `resource = 'teacher_recommendation'` con acciones `create` y `complete`.

Pruebas SQL simuladas y pruebas frontend estructurales; no sustituyen una prueba real con Supabase, navegador y roles.
