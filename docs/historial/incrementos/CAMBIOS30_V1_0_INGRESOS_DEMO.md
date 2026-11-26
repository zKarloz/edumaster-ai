# CAMBIOS 30 v1.0 — Ingresos institucionales DEMO

Maquetado interactivo temporal para administradores institucionales de la institución seleccionada. Ruta `/gestion/ingresos`, grupo Gestión. No concede permisos de backend ni representa un sistema contable. Sin migraciones, dependencias nuevas ni consultas financieras.

- Datos ficticios en PEN, período fijo de demostración noviembre de 2026, filtro anual y todos los períodos.
- Matrículas, mensualidades, venta de cursos y certificaciones. Totales de cobros y pendientes en céntimos y gráfico de ingresos recibidos por concepto.
- Registro manual simulado con validación de importe y fecha; marcar pendiente como pagado; restaurar datos iniciales.
- DataTable compartida (búsqueda y paginación 5/10/20), Modal, OptionSelect y Toast; traducciones ES/EN/PT y tokens temáticos.
- Los cambios viven únicamente en memoria de la página y se reinician al desmontar, recargar, cambiar usuario o institución. No introducir datos personales. No emite comprobantes ni modifica matrículas.
- Pendiente: integración financiera real, auditoría, moneda institucional, permisos de servidor, historial y resumen en dashboard por rol.

Validación: `cd apps/web && node --test tests/*.test.cjs`, `npm run build`, `npm run dev`. Comprobar los tres temas y el cambio de contexto institucional. La compilación integral y la prueba visual no se han realizado satisfactoriamente en el entorno de preparación por ausencia de dependencias npm; la sintaxis se comprobó con TypeScript transpileModule.
