# EduMaster.ai — CAMBIOS 16 / v24

Parche incremental sobre **v23**. Solo afecta la interfaz React.

## Incluye

1. **Cursos, tema Negro:** realce menos brillante en tarjetas de lista y cuadrícula (`#929292` y sombra gris tenue); el contorno de teclado también queda en escala gris.
2. **Perfil, diálogos en tema Negro:** separador superior de opciones de foto y edición del nombre en gris (`#383838`) en lugar del azul heredado del tema Oscuro. El tirador del panel inferior se ve gris (`#737373`). También se mantiene la apariencia correcta en Claro y Oscuro.
3. **BottomSheet táctil:** deslizar desde el tirador superior para cerrar. Un gesto corto vuelve a su posición; un arrastre suficiente cierra con transición. El gesto está restringido al tirador (36 px de zona táctil), de modo que no interfiere con desplazamiento de formularios ni edición de campos. La animación respeta preferencias de movimiento reducido; Escape, botón X y pulsación fuera siguen funcionando.

## Archivos

- `apps/web/src/styles.css`
- `apps/web/src/components/shared/Modal.tsx`

No requiere SQL, cambios en Supabase/Render/Vercel, variables de entorno ni dependencias nuevas.

## Instalación

Descomprimir `EduMaster_CAMBIOS16_v24_Parche.zip` sobre la carpeta que **contiene** `edumaster-ai`, conservando las rutas. Si ya estás dentro de la raíz, copiar los dos archivos a sus rutas correspondientes.

Desde la raíz del repositorio, en Git Bash:

```bash
cd apps/web
npm run build
npm run dev
```

Después de comprobar los cambios, volver a la raíz:

```bash
cd "$(git rev-parse --show-toplevel)"
git add apps/web/src/styles.css apps/web/src/components/shared/Modal.tsx LEEME_CAMBIOS16_V24.md
git commit -m "fix(interfaz): suavizar contornos y permitir cerrar paneles con gesto táctil"
git push origin main
```

## Pruebas manuales sugeridas

1. En tema Negro, pasar el cursor y usar Tab en las tarjetas de Cursos (lista/cuadrícula). El borde debe quedar gris y más discreto.
2. Abrir foto y editar nombre desde Perfil en los tres temas, en móvil y escritorio. En Negro, los separadores y el tirador deben ser grises.
3. En un teléfono o la emulación móvil de Chrome, tocar la barra pequeña de la parte superior y arrastrar más de 100 px hacia abajo: debe cerrar el panel.
4. Arrastrar menos de 40 px y soltar: debe regresar al sitio, sin cerrar.
5. Desplazar el formulario con el dedo: **no** debe cerrar el panel.
6. Verificar cierre por Escape, X y toque fuera. Repetir con animaciones desactivadas.

## Verificación en el entorno de preparación

- 163 pruebas existentes de FastAPI: correctas.
- Sintaxis de 35 archivos TS/TSX: verificada por transpilación de TypeScript.
- CSS: analizado sin errores con PostCSS.
- Estilos de colores de las tarjetas, encabezados y tirador: comprobados con Chromium.
- **Compilación completa `npm run build` y gestos reales sobre React: pendientes en tu VSCode/navegador**, porque aquí no están disponibles las dependencias npm del frontend.
