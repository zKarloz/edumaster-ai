# CAMBIOS 28 v1.2 — Capas cartográficas

Aplicar sobre CAMBIOS 32 v1.1.2. Sin dependencias nuevas ni migraciones.

Agregar `VITE_MAPTILER_API_KEY` a `apps/web/.env.local` y a las variables de Vercel. Reiniciar Vite y volver a desplegar. La clave de navegador es pública; restringir orígenes autorizados en MapTiler y no usar claves administrativas. No subir `.env.local`.

Automático (predeterminado) sigue el tema claro/oscuro/negro; las tres selecciones manuales no cambian con el tema. La preferencia se almacena por navegador, compartida entre Instituciones e Inicio al remontar el componente. El selector tiene iconos representativos para no gastar cuota en miniaturas. Se conservan las coordenadas, zoom y popups al cambiar teselas. Si falta clave o falla una tesela MapTiler se usa OpenStreetMap, con aviso y reintento manual si hay clave. No se modifica el mapa de edición de direcciones.

Estilos oficiales streets-v4-light, streets-v4-dark, hybrid-v4; teselas raster XYZ de 256 px. Atribución visible y logo MapTiler. Plan gratuito para desarrollo y uso no comercial según condiciones vigentes: https://www.maptiler.com/cloud/pricing/ . Documentación: https://docs.maptiler.com/cloud/api/maps/ y https://docs.maptiler.com/guides/map-design/attribution/add-attribution/ .

Validación: 171 pruebas Node aprobadas; transpilación TS/TSX y comprobación estricta de mapLayers.ts correctas. Build completo no disponible por falta de dependencias npm en el entorno. Probar manualmente los estilos, zoom, popups, tema automático, persistencia, atribución y respaldo en navegador con una clave real; no se han realizado peticiones autenticadas a MapTiler.
