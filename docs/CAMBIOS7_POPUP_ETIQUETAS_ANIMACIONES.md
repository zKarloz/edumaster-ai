# EduMaster.ai — CAMBIOS 7 (v10)

## Cambios incluidos

1. **Ayuda del código institucional.** `HelpPopover` es un componente reutilizable
   que se abre junto al título del campo. El panel se posiciona de forma flotante
   (`position: absolute`) y NO modifica el alto del formulario ni el tamaño del modal.
   Tiene animación de opacidad al abrir/cerrar (180 ms), botón X, cierre mediante
   clic fuera y Escape. Escape cierra primero la ayuda, no el modal principal.
   Ejemplos visibles: `pe-unmsm`, `co-unal`, `mx-unam` y `es-ucm`.
2. **Espacio entre títulos y campos.** Se aplicó separación uniforme de 6 px
   mediante `gap-1.5` y etiquetas de texto explícitas `<span>` a los campos
   institucionales; el comportamiento antes dependía del espaciado entre hijos,
   pero algunas etiquetas eran nodos de texto.
3. **Entrada de modales.** `.app-modal` reutiliza `module-rise` (250 ms),
   sin modificar portal, backdrop, scroll, foco ni bloqueo del fondo.
4. **Configuración de animaciones.** Nueva preferencia `animationsEnabled`
   (predeterminada `true`) en `SettingsProvider`, con interruptor en `SettingsPage`.
   La configuración se guarda por ámbito de usuario en `localStorage`, y es
   compatible con las preferencias guardadas de versiones anteriores.
   CSS: `html[data-motion="off"]` desactiva animaciones y transiciones.
   `prefers-reduced-motion: reduce` del sistema también se respeta, incluso
   si el interruptor está activado. Los mapas evitan `flyTo` cuando se desactiva.

## Instalación desde v9 (Windows / Git Bash)

1. Haz respaldo de `apps/web/src`.
2. Descomprime `EduMaster_CAMBIOS7_Parche_Frontend_v10.zip` sobre la carpeta
   contenedora de `edumaster-ai` y reemplaza los archivos indicados.
3. En una terminal dentro de `edumaster-ai/apps/web` ejecuta:

```bash
npm run build
npm run dev
```

**No se modifica** PostgreSQL, FastAPI, las credenciales, los archivos `.env`
ni las dependencias de `package.json`. No necesitas reinstalar paquetes.

## Checklist de aceptación

- [ ] Abrir **Instituciones → Nueva institución → ?** y comprobar que aparece
      la ventanita, sin mover los demás campos.
- [ ] Cerrar la ayuda con `?`, X, clic fuera y Escape. Debe desvanecerse
      sin cerrar el modal al usar Escape para la ayuda.
- [ ] Comprobar la separación entre título y control de todos los campos.
- [ ] Abrir/cerrar **Nueva institución** y **Editar institución**: entrada
      ascendente del modal; mantiene overlay completo y bloqueo del scroll.
- [ ] En **Configuración**, desactivar animaciones; volver al módulo y
      comprobar que el modal, el sidebar, las ayudas, los cambios de módulo
      y notificaciones dejan de animarse. Rehabilitarlas para comprobar.
- [ ] Recargar la página con sesión activa y comprobar que la preferencia
      se conserva; verificar en claro, oscuro y negro y en pantalla móvil.
- [ ] Con el sistema configurado en **Reducir movimiento**, comprobar que
      la preferencia del SO también suprime las animaciones.

## Validación técnica en el entorno de preparación

- Sintaxis TypeScript/TSX analizada con el compilador de TypeScript: sin errores
  de sintaxis en los 17 archivos revisados.
- No se pudo ejecutar `npm install` (agotó el tiempo por red), por lo que
  `npm run build` y los controles visuales quedan pendientes en VSCode.
- No se requiere ninguna migración SQL.
