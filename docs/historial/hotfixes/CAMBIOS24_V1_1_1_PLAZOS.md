# CAMBIOS 24 v1.1.1 — Plazos y etiqueta docente

- La columna y el detalle muestran Docente / Teacher / Docente, sin cambiar el contrato `author`.
- El plazo se calcula desde la fecha ISO con zona y el reloj del dispositivo; se actualiza cada 15 segundos mientras la vista del estudiante está montada. La fecha límite se muestra en la zona local del navegador.
- La regla de prioridad alta sigue siendo 48 horas. Se ocultan sugerencias vencidas localmente; FastAPI conserva la autoridad sobre las entregas y permisos. No se modifica el backend.
- Validación: 130 pruebas Node aprobadas y comprobación sintáctica TS/TSX. Compilación completa y prueba de navegador pendientes.
- Sin migraciones ni dependencias nuevas. Comunidad académica queda para un incremento independiente.
