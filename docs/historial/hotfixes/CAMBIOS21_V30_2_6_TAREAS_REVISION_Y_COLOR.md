# CAMBIOS 21 · v30.2.6 — Hora de vencimiento, revisión integrada y color de pestañas

Base: v30.2.5. Este paquete no ejecuta SQL ni altera los permisos en FastAPI.

## Ajustes

1. **Fecha de vencimiento opcional y hora preseleccionada 23:59.** La pantalla de creación/edición divide fecha y hora en campos accesibles. La fecha queda sin seleccionar en tareas nuevas y, por tanto, el backend recibe `due_at: null` hasta que se indique una fecha. Si se introduce una fecha, se combina con la hora local seleccionada y se transforma a ISO; al editar una tarea existente se restauran sus fecha y hora reales.
2. **Entregas dentro del detalle docente.** En tareas publicadas o cerradas, la tabla compartida paginada de entregas aparece bajo el contenido de la tarea, sin botón intermedio «Revisar entregas». Cada intento abre la página de revisión individual. Al regresar, se conserva el número de página. La URL anterior de listado de entregas permanece disponible como enlace compatible; ambos flujos siguen requiriendo autorización en FastAPI.
3. **Cerrar tarea arriba a la derecha.** Solo se muestra al docente cuando está publicada. Conserva confirmación y actualización posterior.
4. **Color del curso en tema Negro.** Se quita `grayscale(1)` y se conserva la mezcla del acento del curso con negro para la barra de pestañas, manteniendo tipografía blanca y bordes con contraste.

## Validación

- En Cursos → Actividades y tareas → Nueva tarea, verificar hora 23:59 (11:59 p. m.) y fecha vacía. Guardar sin fecha debe dejar el plazo vacío.
- Elegir una fecha y guardar: comprobar que el plazo aparece a las 23:59 local. Editar fecha y hora de un borrador existente y confirmar persistencia.
- Publicar tarea docente: tabla de entregas debajo, botón «Cerrar tarea» arriba a la derecha y sin botón de navegación a listado. Probar paginación, detalle de una entrega y regreso.
- Probar barra de pestañas en los temas Claro, Oscuro y Negro, con el mismo acento del curso más oscuro.
- `npm run build`, `npm run test:editor`, `npm run test:tasks`, y las pruebas del backend previamente validadas si se desea una regresión completa.

## Seguridad y alcance

No se modifica autorización, buckets, variables de entorno ni migraciones. La tabla compartida consulta los endpoints existentes sujetos a institución, oferta y rol docente. No se publica en GitHub automáticamente.
