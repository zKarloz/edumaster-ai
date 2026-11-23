# EduMaster.ai — CAMBIOS 12 / v20

Parche incremental sobre **v19**, para corregir la alineación del sidebar, mejorar el selector de modo de navegación y hacer que el topbar indique la categoría del módulo activo. **No cambia** la API, la base de datos, las rutas, los roles ni los contratos del frontend. **No requiere migración SQL ni nuevas dependencias.**

## Qué cambia

1. **Categorías con sidebar colapsado:** el indicador ahora es un separador horizontal del mismo grosor (1 px) y color (`var(--app-panel-border)`) que la línea situada encima de «Modo de navegación», en todos los temas. Las cabeceras de categoría conservan una altura fija de 20 px para evitar saltos.
2. **Íconos alineados:** las opciones del menú disponen de una celda fija de 19 × 19 px, con la misma sangría horizontal que el ícono inferior de «Modo de navegación» (24 px desde el borde interior de referencia). El área de navegación continúa desplazándose con rueda, teclado o pantalla táctil, pero su scrollbar no modifica el ancho del rail al contraerse.
3. **Selector del modo de navegación:** quitamos el check visual. La opción seleccionada mantiene un fondo de selección propio de cada tema y la opción bajo el cursor obtiene un fondo diferente y más oscuro. `aria-pressed` conserva la indicación accesible de la selección para lectores de pantalla.
4. **Topbar contextual:** sustituimos el texto fijo «Administración» por la categoría de la pantalla activa: «Plataforma», «Gestión», «Académico» o «Sistema». El perfil personal muestra «Mi cuenta». Se utilizan las traducciones ES/EN/PT ya existentes.

## Instalación

1. Descomprime el ZIP **Parche v20** en la carpeta que contiene `edumaster-ai` y permite reemplazar los archivos.
2. Desde `apps/web`, ejecuta:
   ```bash
   npm run build
   npm run dev
   ```
3. Comprueba en los temas Claro, Oscuro y Negro las tres modalidades del sidebar; mueve el cursor por las tres opciones del selector; navega entre Gestión, Académico y Sistema y comprueba el encabezado.
4. Desde la raíz `edumaster-ai`, **solo si el build pasa**:
   ```bash
   git status
   git add apps/web/src/App.tsx apps/web/src/styles.css LEEME_CAMBIOS12_V20.md
   git commit -m "fix(interfaz): alinear iconos del sidebar y mejorar selector de navegación"
   git push origin main
   ```

GitHub Actions, Render y Vercel mantienen la configuración anterior y procesarán el nuevo commit automáticamente.

## Verificaciones realizadas

- **151 pruebas FastAPI**: pasan (`python -m pytest -q`). No hubo cambios backend.
- Sintaxis de **33 archivos TS/TSX**: verificada mediante `typescript.transpileModule`; no sustituye la comprobación estricta completa.
- CSS: analizado con PostCSS y compilado con Tailwind CSS para prueba visual.
- Chromium: en una maqueta de los elementos reales del sidebar, el ícono de un módulo y el control inferior mantienen `x = 24 px` en ancho normal y colapsado; la altura de cada encabezado es 20 px; el separador de categoría y el inferior tienen el mismo color. El fondo de opción seleccionada y el de hover se distinguen en **Claro, Oscuro y Negro**, siendo el hover más oscuro.
- **Pendiente en tu entorno:** `npm run build` con todas las dependencias React y comprobación visual de la aplicación completa. No se ha probado la interfaz de React real en los servidores.

## Notas de accesibilidad

- No ocultamos el estado seleccionado a tecnologías de asistencia: se mantiene `aria-pressed`.
- La reducción de movimiento (`prefers-reduced-motion` y ajuste Animaciones) sigue respetándose.
- La ocultación visual de la barra de desplazamiento del listado **no impide el desplazamiento** ni altera la barra de la página.
