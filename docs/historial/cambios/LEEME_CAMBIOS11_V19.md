# EduMaster.ai — CAMBIOS 11 / v19

Actualización incremental sobre **v18.1**. No ejecuta migraciones SQL, no cambia contratos de FastAPI, no requiere variables de entorno adicionales ni agrega dependencias npm.

## Cambios incluidos

1. **Configuración:** las opciones de animaciones, idioma y otras preferencias comparten una transición de selección suave. Respetan el ajuste de movimiento y `prefers-reduced-motion`.
2. **Desenfoque global:** nueva preferencia «Permitir fondos difuminados», almacenada en el navegador **por usuario** mediante `SettingsProvider`. Desactivarla convierte la cabecera en un panel opaco y deshabilita el desenfoque de los modales. Es independiente del selector de sombreado de modales, que conserva su valor.
3. **Categorías colapsadas:** el guion de texto se reemplaza por una línea gris de 20 × 3 px. Se mantiene la altura del rótulo para que los módulos y sus íconos no cambien de posición.
4. **Selector de navegación:** abre y cierra con la misma transición del menú de cuenta; permanece abierto al salir del sidebar. Se cierra al elegir una opción, con Escape o al interactuar fuera. Al usar Escape se devuelve el foco al botón de control.
5. **Cuenta desplegada:** el avatar permanece en el botón superior, pero no se repite en el menú. El menú muestra los roles que correspondan a la institución seleccionada y debajo el correo; incluye traducciones ES/EN/PT. Las cuentas con múltiples roles los ven separados por puntos medios.
6. **Sidebar dinámico:** se distingue navegación de teclado del foco dejado por un clic del ratón. Seleccionar un módulo ya no debe mantener el menú abierto. La sombra del panel depende del estado real de expansión, no de `:focus-within`.
7. **Botón de navegación:** ícono con tamaño fijo y sin flex-shrink; etiqueta en una sola línea y recortada de forma segura durante el cambio de ancho.

## Instalación

1. Respaldar tu rama local y extraer el parche en la carpeta que contiene `edumaster-ai`, conservando la estructura de rutas.
2. En `apps/web`, ejecutar:
   ```bash
   npm run build
   npm run dev
   ```
3. En `apps/api`, opcionalmente comprobar regresiones (el backend no cambió):
   ```bash
   python -m ruff check app tests
   python -m pytest -q
   ```
4. Desde la raíz del repositorio, **solo después de compilar**:
   ```bash
   git status
   git add apps/web/src/App.tsx apps/web/src/styles.css apps/web/src/i18n.ts apps/web/src/providers/SettingsProvider.tsx apps/web/src/modules/settings/SettingsPage.tsx apps/web/src/components/shared/AccountMenu.tsx LEEME_CAMBIOS11_V19.md
   git commit -m "fix(interfaz): mejorar preferencias y comportamiento del sidebar"
   git push origin main
   ```

## Pruebas manuales prioritarias

- Modo dinámico: seleccionarlo; salir del sidebar y comprobar que colapsa. Volver a entrar y comprobar que expande.
- Modo dinámico: hacer clic en Cursos (y luego otro módulo) y retirar el ratón. Debe colapsar sin hacer clic en zonas vacías.
- Pulsar «Modo de navegación», retirar el ratón **sin seleccionar nada**: el selector permanece visible y operable. Cerrar con Escape y haciendo clic fuera.
- Con el sidebar colapsado: revisar separadores en las cuatro categorías y que ningún ícono de módulo se mueva al expandirlo.
- Repetir en los temas Claro, Oscuro y Negro; verificar que los botones y etiquetas no salten a dos líneas.
- En Configuración: activar/desactivar animaciones y desenfoque; recargar y verificar que permanezcan para ese usuario.
- Cambiar de cuenta para confirmar que las preferencias no se mezclan entre usuarios.
- Abrir menú de cuenta: debe mostrar roles y correo sin duplicar el avatar.
- Comprobar el selector y el nuevo ajuste en Español, English y Português.

## Verificación efectuada al preparar este paquete

- `python -m pytest -q` en FastAPI: **151 pruebas correctas**.
- Sintaxis de **33 archivos** TypeScript/TSX comprobada con TypeScript `transpileModule`.
- Diccionarios de `settings` y `account`: las claves coinciden en español, inglés y portugués.
- CSS probado en Chromium: fondos sólidos para los tres temas al desactivar blur y transición de apertura del selector de navegación.

**Pendiente:** compilación completa `npm run build` y prueba de las interacciones React con tu proyecto en VSCode. En el entorno de generación la descarga de paquetes npm no se completó. No realices el `git push` si falla el build.
