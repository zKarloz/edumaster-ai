# CAMBIOS 26 v1.0 — Ajustes menores de interfaz

- Inicio de curso: elimina únicamente las dos tarjetas placeholder de tareas y evaluaciones; conserva resumen, contenido y pestañas funcionales. Retira el aviso obsoleto en ES/EN/PT.
- Sidebar: encabezados de grupo sin salto de línea, altura fija y recorte durante la transición de ancho. Conserva el separador del modo contraído, el comportamiento móvil y las preferencias de movimiento.
- Sin cambios de API, SQL, dependencias ni permisos.
- Validación: `cd apps/web && node --test tests/*.test.cjs`, `npm run build` y `npm run dev`. Comprobar Inicio como docente y estudiante, y abrir/cerrar el sidebar dinámico en los tres temas e idiomas.
- El siguiente incremento revisará visibilidad por permisos. Ingresos (registro manual de matrículas, mensualidades, cursos y certificaciones), mapa geográfico de progreso y landing pública se diseñarán aparte; si faltan datos o tiempo, usar maquetas claramente identificadas.
