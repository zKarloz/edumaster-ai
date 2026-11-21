# EduMaster.ai — CAMBIOS 4 (v6)

## Alcance

Actualización **solo de frontend**. No requiere migraciones SQL ni cambios de `.env`, Supabase o FastAPI.

### 1. Contenido más ancho

- Antes: `main` con máximo de `1440px`, padding `px-5 sm:px-6 lg:px-8 2xl:px-10`.
- Ahora: `main` con máximo de `1680px`, padding `px-4 sm:px-4 lg:px-5 2xl:px-7`.
- El espacio junto al sidebar y el borde derecho sigue siendo adaptable a cada pantalla. En pantallas que no alcanzaban el máximo anterior, el cambio se aprecia principalmente al reducir los márgenes laterales.

### 2. Controles y aviso del mapa

- Se desactiva el control de zoom predeterminado de Leaflet y se añade `ZoomControl` en la **esquina inferior izquierda**.
- El aviso de mapa sin instituciones se mantiene en la parte superior, priorizando la derecha en escritorio.
- El mapa conserva el atribución OpenStreetMap y los filtros de la versión 5.

### 3. Modal compartido

- Se renderiza con `createPortal(..., document.body)`, fuera del contenedor con animación de subida y de la jerarquía de capas del mapa Leaflet.
- Su overlay cubre el viewport completo; el diálogo queda centrado horizontal y verticalmente mientras quepa en pantalla.
- Para pantallas bajas, el diálogo tiene un alto máximo y **solo su contenido interno es desplazable**.
- Se bloquea el scroll de `html` y `body` mientras está abierto; se restauran los valores originales al cerrar.
- Se conserva cierre por Escape, botón X y clic en el fondo, retorno del foco, y se añade contención del foco con Tab/Shift+Tab.
- El formulario de instituciones deja de crear un segundo scroll interno.

## Cómo instalar

1. Realiza copia de seguridad (o un commit Git) de tu proyecto.
2. Descomprime el parche en la carpeta padre de `edumaster-ai`, para que las rutas `edumaster-ai/apps/web/src/...` coincidan. **No copies el directorio `edumaster-ai` dentro de otro `edumaster-ai`.**
3. No modifiques tus archivos `.env`.
4. En Git Bash, abre `edumaster-ai/apps/web`:

```bash
npm run build
npm run dev
```

5. Abre Instituciones, prueba los botones +/- abajo a la izquierda, selecciona **Nueva institución**, verifica que el formulario esté por encima del mapa y que no se pueda desplazar la página detrás.
6. Prueba además el modal con Escape, botón X y clic fuera; revisa modo Claro, Oscuro y Negro y una pantalla móvil.

## Verificación

- Parseo de archivos TS y TSX con el parser oficial de TypeScript: **sin errores de sintaxis**.
- Pendiente en la máquina de desarrollo: `npm run build` y comprobación visual real en navegador con dependencias instaladas.
