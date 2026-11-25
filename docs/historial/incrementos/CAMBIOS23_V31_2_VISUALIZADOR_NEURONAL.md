# CAMBIOS 23 — v31.2 · Visualizador neuronal interactivo (DEMO)

## Objetivo

Visualizar de forma didáctica y accesible la selección de seis entradas académicas y la propagación ilustrativa de una señal por dos capas ocultas hasta seis salidas. Este incremento **no entrena ni ejecuta ninguna red neuronal**: el laboratorio v31.1 sigue utilizando regresión logística.

## Integración

- Sidebar → **Inteligencia artificial → Red neuronal**.
- Ruta estable y recargable: `/inteligencia-artificial/red-neuronal`.
- Disponible para usuarios autenticados/autorizados por la aplicación; no consulta API ni información académica real.
- Entradas: uso de plataforma, rendimiento, participación, interacciones, asistencias y comentarios.
- Controles: selección individual (botón y SVG), pausa/reanudar, repetir, vista general.
- Fases: entrada → capa oculta 1 → capa oculta 2 → salidas de ejemplo.
- Textos ES/EN/PT; diseño adaptado a Claro, Oscuro, Negro y móviles.
- Animación inhabilitada con la opción de EduMaster o `prefers-reduced-motion`.
- Componentes y estilos compartidos de EduMaster (`app-panel`, `app-secondary-button`, preferencias globales, navegación y `Spinner`).

## Seguridad y alcance

- **Todo el contenido es DEMO.** La iluminación de una entrada no significa que el modelo deje de utilizar las demás variables.
- Las rutas resaltadas **no representan** pesos entrenados, importancia de variables, explicaciones causales, inferencia ni predicciones.
- No se emiten certificados, se modifican notas, se consultan expedientes ni se almacena información personal.
- No hay cambios en FastAPI, Supabase, migraciones SQL ni dependencias npm.

## Validación en VSCode

Desde `apps/web`:

```bash
npm run build
npm run test:neural
npm run test:editor
npm run test:tasks
npm run test:users
```

Validación visual: seleccionar cada entrada por clic y teclado, confirmar el atenuado de las demás, la secuencia de fases, el control pausa/reanudar y repetir, la ruta tras recargar, los tres temas, el overflow móvil y el modo reducido de movimiento.

## Futuro

Una implementación con activaciones o importancias reales requiere un modelo neuronal entrenado, evaluado, una API con autorización por institución y una metodología explícita de explicación. No conectar directamente este SVG a `baseline.py` (regresión logística) representándolo como una red multicapa.
