# EduMaster.ai — CAMBIOS 14 (v22)

**Base:** proyecto v21.1 (CAMBIOS 13 + hotfix F401).

## Cambios

1. Cursos en Negro: el hover y el foco de teclado muestran un contorno gris claro y una sombra tenue. En Claro y Oscuro se conserva el color de la materia.
2. Topbar: se retira `EduMaster.ai /` y se conserva la categoría (en negrita y mayúsculas) y el nombre del módulo.
3. Búsqueda en Cursos: se reutiliza `search-control`; un único foco redondeado rodea el control completo, sin rectángulo dentro del input.
4. Se elimina el encabezado de módulo redundante en App (incluido `Sesión: ... · Datos limitados...`). También se retiran los encabezados repetidos de Cursos/Matrículas/Estudiantes y Actividad académica. **Permanecen los títulos de secciones con contenido propio**, como filtros, seguimiento y tarjetas de Configuración.
5. Perfil: tarjeta Información personal de ancho completo, portada con la misma fotografía difuminada (no se envía a servicios externos), color estable de respaldo si no hay foto, avatar de 128 px, nombre grande y correo a su lado. Lápiz junto al nombre abre un Modal compartido para editarlo. Lápiz sobre la foto se revela al pasar el cursor o mediante el foco del teclado; en móvil permanece visible para que sea accesible. Eliminar foto sigue disponible. La tarjeta Seguridad de la cuenta pasa debajo y mantiene su modal de contraseña.
6. Las imágenes no se utilizan en el desenfoque de la portada si el usuario desactivó el blur global; se muestra el degradado neutro basado en su color de avatar. Se respeta la preferencia de animaciones y `prefers-reduced-motion`.

## Instalación

1. Descomprime el parche sobre la carpeta del proyecto, manteniendo las rutas.
2. En `apps/web`, ejecuta:

   ```bash
   npm install
   npm run build
   npm run dev
   ```

   Si las dependencias ya están instaladas, `npm install` no es obligatorio. **No se incorporan paquetes nuevos**.
3. Verifica los temas Claro, Oscuro y Negro; sobre todo el hover/foco de Cursos, el control de búsqueda, el nuevo Perfil y los modales de nombre y contraseña.
4. Desde la raíz del repositorio:

   ```bash
   git add apps/web/src/App.tsx apps/web/src/styles.css apps/web/src/modules/academic/AcademicPage.tsx apps/web/src/modules/academic/AcademicActivityPage.tsx apps/web/src/modules/academic/CourseCatalog.tsx apps/web/src/modules/profile/ProfilePage.tsx apps/web/src/components/shared/UserAvatar.tsx LEEME_CAMBIOS14_V22.md
   git commit -m "fix(interfaz): mejorar cursos, encabezados y diseño del perfil"
   git push origin main
   ```

## Infraestructura

- No ejecutar SQL; no existen migraciones nuevas.
- No cambiar variables de Supabase, Vercel ni Render.
- Backend intacto; no afecta permisos, matrícula, notas ni autenticación.

## Comprobaciones realizadas

- 163/163 pruebas existentes de FastAPI correctas.
- Transpilación sintáctica de 34 archivos TS/TSX sin errores.
- CSS analizado sintácticamente.
- Hover de Cursos en tema Negro y foco de búsqueda verificados en Chromium.
- **No se ha realizado un `npm run build` completo válido aquí**, porque no están instalados los paquetes npm; debe aprobarse antes de `git push`.
