# EduMaster.ai — CAMBIOS 17 / v25

Parche incremental sobre **v24**. Cambios solo en frontend, sin migraciones SQL ni dependencias nuevas.

## Correcciones

1. **Editar nombre:** el diálogo (modal de escritorio y panel inferior de teléfono) ahora se titula «Editar nombre» en vez de «Nombre completo». La etiqueta del campo sigue diciendo «Nombre completo»; así se mantiene el contexto sin repetir el título. Incluye ES («Editar nombre»), EN («Edit name») y PT-BR («Editar nome»).
2. **Arrastre corto del panel inferior:** al arrastrar desde el tirador y soltar antes del umbral de cierre, el panel vuelve suavemente a su posición sin ejecutar nuevamente la animación de entrada. Se desactiva la animación de entrada para el resto de **ese montaje del diálogo** cuando empieza un gesto táctil. Al cerrar y abrir un diálogo nuevo, la animación inicial sigue funcionando.

### Archivos modificados

- `apps/web/src/modules/profile/ProfilePage.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/src/components/shared/Modal.tsx`
- `apps/web/src/styles.css`

## Instalación y prueba

Descomprimir el ZIP sobre la carpeta que contiene `edumaster-ai`, respetando las rutas. No reemplazar los `.env` locales.

Desde `apps/web`, en VSCode con Git Bash:

```bash
npm run build
npm run dev
```

Probar en móvil o emulador táctil de Chromium:

1. En Perfil, pulsar el lápiz junto al nombre: el panel debe titularse **Editar nombre** (también en escritorio).
2. Desde el tirador del panel inferior, arrastrar unos 20–30 px hacia abajo y soltar: debe volver sin parpadeos ni repetir la animación de apertura.
3. Arrastrar más de 100 px para cerrar. Abrir otra vez el panel: debe aparecer con su transición normal.
4. Verificar cerrar con Escape, botón X y clic fuera; también con animaciones desactivadas.
5. Cambiar idioma a inglés y portugués para comprobar los títulos equivalentes.

Si el build finaliza correctamente, desde la raíz del repositorio:

```bash
cd "$(git rev-parse --show-toplevel)"
git add apps/web/src/modules/profile/ProfilePage.tsx apps/web/src/i18n.ts apps/web/src/components/shared/Modal.tsx apps/web/src/styles.css LEEME_CAMBIOS17_V25.md
git commit -m "fix(interfaz): corregir título de edición y rebote del panel móvil"
git push origin main
```

## Verificación en preparación

- 163 pruebas existentes de FastAPI: correctas.
- 35 archivos TypeScript/TSX: sintaxis verificada con TypeScript.
- Estilos CSS: analizados con PostCSS.
- Chromium (375 px): la entrada se anima al abrir, el rebote mantiene `animation-name: none` y una apertura nueva vuelve a ejecutar `app-sheet-rise`; a 800 px se conserva `module-rise` de escritorio.
- **Compilación completa `npm run build` y gestos con el componente React real: por comprobar en tu entorno.**
