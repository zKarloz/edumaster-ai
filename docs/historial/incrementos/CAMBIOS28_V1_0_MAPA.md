# CAMBIOS 28 v1.0 — Mapa institucional

- Sustituye el enlace redundante por recuentos reales de matrículas y alumnos registrados (todos los estados, no solo activos). Cada alumno se cuenta una vez por institución según la clave única de membresía de `app.students`.
- La API conserva el catálogo autorizado y añade dos campos nullable, únicamente para superadmin o gestor activo de esa institución. No exporta datos personales.
- La selección de sede sigue funcionando; no cambia el contexto activo automáticamente. Popup con tokens de los tres temas y textos ES/EN/PT.
- Sin migraciones ni dependencias. Desplegar API y frontend; si el backend es anterior no se muestran recuentos, nunca ceros ficticios.
- El mapa geográfico de progreso queda pendiente de diseño y cobertura de datos. No se calculan ni inventan porcentajes.
- Validar Ruff, pytest, npm build y dos instituciones (incluida la vacía), así como acceso multirrol y los tres temas.
