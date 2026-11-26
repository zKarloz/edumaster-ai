# CAMBIOS 24 v1.1 — Sugerencias académicas y colores semánticos

## Alcance
- Se conserva el contrato `normal`/`high`; normal se presenta como Media/Medium/Média.
- Media y Pendiente: amarillo; Alta: rojo; Completada: verde. Se reutilizan las insignias de tareas y se añade una paleta roja para Claro, Oscuro y Negro.
- Sugerencias privadas de solo lectura para estudiantes con matrícula activa, oferta abierta y curso publicado. Solo tareas publicadas, no vencidas, sin ninguna entrega del estudiante. Alta cuando vence en las próximas 48 horas; Media en los demás casos. Máximo 50 tareas ordenadas por fecha límite; sin fecha al final.
- GET `/api/v1/academic/organizations/{organization_id}/course-offerings/{offering_id}/recommendations/suggestions`. Reutiliza `_context` y `_student`; no admite identificadores de otras matrículas. Las sugerencias se recalculan al consultar y no se guardan, no cambian notas ni son inferencias neuronales. La consulta es independiente de las recomendaciones humanas.
- No hay migración, variables ni dependencias nuevas. No se implementan reglas de calificaciones, progreso o inactividad en esta versión.

## Validación
- 398 pruebas pytest y 129 pruebas Node aprobadas en copia de revisión. Pruebas SQL simuladas y frontend estructural; sintaxis TSX comprobada. Ruff, compilación completa y ejecución real contra Supabase pendientes.
- Ejecutar desde apps/api: `python -m ruff check app tests` y `python -m pytest -q`.
- Desde apps/web: `node --test tests/*.test.cjs` y `npm run build`.
- Probar con estudiante activo: tarea publicada sin entrega y vencimiento futuro (dentro de 48 h: Alta, fuera: Media), tarea sin fecha (Media), tarea ya entregada/vencida/borrador (no debe aparecer). Abrir tarea y entregar; regresar y actualizar. Verificar con docente y otros estudiantes que no se muestran sugerencias ajenas. Comprobar los colores en tabla, detalle y resumen en los tres temas. Las sugerencias no son recomendaciones docentes persistidas.
- Aplicar en raíz, revisar git diff, commit y push a main. Actualizar Render y Vercel; Supabase sin cambios.
