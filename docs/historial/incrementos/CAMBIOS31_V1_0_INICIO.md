# CAMBIOS 31 v1.0 — Inicio administrativo

Incremento exclusivamente frontend. Aplicar después de CAMBIOS 30 v1.0. No requiere SQL, dependencias ni cambios de API.

- Vista global: catálogo institucional autorizado (máximo 500), mapa existente, alumnos y matrículas históricos de las instituciones consultadas, sedes geolocalizadas y estado real de la comprobación HTTP de FastAPI. No implica verificación independiente de Vercel o Supabase.
- Gestores: total de ofertas de cursos publicados (filtro predeterminado del endpoint), directorio de docentes activos (máximo 250), distribución de ofertas no canceladas consultadas (máximo 200), alumnos y matrículas registrados. No se consulta un directorio de alumnos nominal para obtener los indicadores.
- Administrador institucional: resumen de la misma semilla y cálculos de Ingresos DEMO, noviembre 2026. Los cambios simulados se siguen perdiendo al salir del módulo Ingresos, conforme a v30.
- Selector de vistas disponible solo para roles del contexto seleccionado y roles globales válidos. Los accesos rápidos se intersectan con moduleAccess. Las consultas se cancelan al cambiar de contexto.
- Docente, estudiante, analista e ingeniero: bienvenida y accesos permitidos, sin estadísticas aún. Se ampliarán en v1.1 y v1.2.
- No se han incorporado todavía total global de usuarios/ofertas, distribución de roles, historial de crecimiento, auditoría reciente, actividad vigente ni porcentajes de progreso. No se inventan datos.

Validación: node --test tests/*.test.cjs: 161 aprobadas. Transpilación sintáctica de tres archivos TS/TSX sin diagnósticos; tsc estricto aislado dashboardScope.ts aprobado. Build completo intentado y bloqueado por dependencias npm ausentes. No se ha probado con navegador ni Supabase real.

Comprobar los tres temas, los tres idiomas, roles múltiples, cambio de institución y estados de error/carga. Ejecutar npm run build antes de desplegar.
