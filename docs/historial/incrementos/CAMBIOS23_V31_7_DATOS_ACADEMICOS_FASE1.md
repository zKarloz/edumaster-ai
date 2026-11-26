# v31.7 — Integración académica, fase 1: inventario agregado

En Entrenamiento, el superadmin dispone de un acordeón cerrado inicialmente para consultar nueve fuentes de una institución seleccionada. El endpoint GET `/api/v1/neural-academic/organizations/{organization_id}/readiness` comprueba el rol activo y la institución activa; cada subconsulta filtra organization_id. El límite de ejecución de la consulta es 5 segundos. No devuelve identificadores de alumnos, notas individuales, textos ni eventos detallados. No hay migración ni dependencia nueva.

Los recuentos son filas, no estudiantes únicos ni cobertura de características. Las actividades excluyen anuladas. No equivalen a muestras entrenables ni acreditan autorización. El entrenamiento y los checkpoints siguen siendo SYNTHETIC DEMO.

Pendiente: revisar resultados reales, definir el instante de corte y etiqueta de finalización con historial verificable, validar disponibilidad temporal de señales (progress_snapshots y notas actuales no garantizan historial), aprobar política institucional, generar dataset minimizado y versionado, verificar modelos independientemente y habilitar inferencia autorizada. No convertir ausencia de eventos en inactividad sin validar instrumentación.

Validación local: `python -m ruff check app tests`, `python -m pytest -q` en apps/api; `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build` en apps/web. Comprobar que dos instituciones devuelvan sus propios recuentos, que una cuenta no superadmin no vea el panel y reciba 403 en API, y que el laboratorio DEMO no cambie. El endpoint no modifica la base de datos.
