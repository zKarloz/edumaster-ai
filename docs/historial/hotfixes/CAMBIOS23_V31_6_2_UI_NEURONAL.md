# CAMBIOS 23 — v31.6.2 UI neuronal

Incremento de presentación sobre v31.6.1. No modifica el entrenamiento, el dataset, IndexedDB ni los servicios remotos.

- Arquitectura presenta únicamente el modelo entrenado; sin resultados ofrece accesos a Entrenamiento y Modelos. Se conservan los archivos conceptuales históricos, pero no se montan en la página.
- Historial de pérdida: SVG con altura de referencia 320, ancho mínimo 760 px y separación de 34 unidades por época; desplazamiento horizontal dentro del gráfico y contorno con tokens temáticos.
- Los nuevos segmentos se dibujan progresivamente; marcadores y valores de las tarjetas incorporan transiciones. Respeta la preferencia de movimiento del sistema y de EduMaster. No se interpolan datos de pérdida ni se altera el entrenamiento.
- Se mantienen inspección mediante ratón, toque y teclado, mejor época e historial paginado.
- Se actualizan los contratos de regresión que exigían la vista conceptual retirada de la interfaz.

## Aplicación
Descomprimir sobre la raíz, ejecutar `cd apps/web`, `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build` y `npm run dev`. No se requieren nuevas dependencias.

## Aceptación
Probar Arquitectura con y sin checkpoint; entrenar y cambiar de pestaña; probar scroll horizontal en un teléfono y verificar que no se desborde toda la página; inspeccionar épocas por ratón y toque; comprobar los tres temas y desactivar animaciones desde ajustes. Los ejes pueden cambiar de escala cuando llegan nuevos valores; no se inventan pérdidas intermedias.

La compilación completa y la revisión visual quedan pendientes en el equipo de desarrollo.

El registro centralizado de modelos se traslada al siguiente incremento (v31.6.3 propuesta).
