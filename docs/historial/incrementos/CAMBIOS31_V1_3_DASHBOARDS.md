# CAMBIOS 31 v1.3 — Distribución y seguimiento administrativo

Aplicar después de CAMBIOS 28 v1.2 y CAMBIOS 32 v1.1.2. No requiere migraciones, backend ni dependencias nuevas.

- Elimina el panel genérico de accesos rápidos en todas las vistas de Inicio. Conserva enlaces contextuales a recursos y módulos específicos.
- Superadministrador: mapa con mayor anchura en escritorio; paneles secundarios de altura natural; estado institucional, ausencia de ubicación, alumnos registrados y tabla compartida paginada por institución. La conexión FastAPI no implica disponibilidad de otros servicios.
- Administrador y coordinador: distribución de ofertas no canceladas y alertas para ofertas abiertas o planificadas sin docente o sin matrículas activas. Un enlace abre la oferta cuando la política de acceso lo permite. Los datos se limitan a las 200 ofertas consultadas.
- Coordinador: no se reserva una columna para finanzas; administrador conserva ingresos DEMO. Los paneles especializados tampoco se estiran automáticamente.
- Los indicadores institucionales derivan del catálogo existente (máximo 500); los recuentos desconocidos no equivalen a cero. No se agregan estadísticas históricas ni se cambian permisos.
- Textos ES/EN/PT. Se reutiliza DataTable con paginación 5/10/20 y las clases de tema existentes.

## Validación

Desde apps/web: `node --test tests/*.test.cjs`, `npm run build`, `npm run dev`. En revisión: 174 pruebas pasaron, transpilación sin diagnósticos y TypeScript estricto de overviewCounts.ts correcto. Build intentado, bloqueado por dependencias npm ausentes. Pendiente verificación visual y navegación real con las cuentas autorizadas.

## Pendiente

Favoritos personalizados v1.4; estadísticas históricas y agregados avanzados v1.5. No se incluyen en este incremento.
