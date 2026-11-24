# CAMBIOS 21 — v30.2.8 · Separadores temáticos y ancho editorial

Base: v30.2.7 aplicada. Hotfix visual sin SQL, sin cambios de FastAPI, sin dependencias.

- Se agrega `app-divider` a la separación entre recursos existentes y los formularios de nuevo enlace/archivo privado.
- Se agrega `app-divider` al encabezado de «Recursos de la lección» en la vista publicada.
- Ambos reutilizan `--app-panel-border` de los temas Claro, Oscuro y Negro; no se agregan colores fijos.
- Creación y edición de lecciones pasan de `max-w-5xl` a `max-w-7xl` respetando el ancho del contenedor responsivo.
- Pruebas de regresión en `lesson-layout-v30_2_8.test.cjs`.

Validación pendiente en la instalación real: `npm run build`, `npm run test:editor`, `npm run test:tasks` y comprobación visual en los tres temas, escritorio y teléfono.
No se ejecuta SQL ni Git automáticamente.
