# CAMBIOS 32 v1.0 — Portada pública

- La raíz `/` muestra LandingPage tanto con sesión como sin sesión. Acceder lleva a `/login` o `/inicio` según la sesión; `/app` conserva su redirección histórica.
- Se conserva el formulario de Login, su autenticación y el acceso a las rutas privadas. Las rutas privadas sin sesión mantienen la URL y muestran el formulario, para recuperar el destino tras autenticarse. La invitación detectada tiene prioridad sobre la portada. El cierre de sesión usa `/login`.
- Se incluyen ocho secciones, textos ES/EN/PT, temas existentes, menú móvil y descripción explícita del laboratorio DEMO. Sin migraciones ni nuevas dependencias.
- Fotografías seleccionadas y licencia Pexels documentadas en `apps/web/public/images/landing/README.md`. La descarga no fue posible en el entorno de revisión: ejecutar desde `apps/web` `bash scripts/download-landing-photos.sh` antes de compilar. Los JPEG no están incluidos; si faltan aparece un panel gráfico. WebP pendiente.
- Validación: 165 pruebas Node, transpilación TS/TSX y sintaxis Bash. `npm run build` no puede completarse en el entorno sin dependencias instaladas. No se ha probado el navegador, el flujo real Supabase ni los archivos fotográficos descargados.
- Verificar `/`, `/login`, `/inicio`, `/app`, invitación real, enlaces profundos sin sesión, cerrar sesión, temas, idiomas y navegación móvil antes del despliegue.
