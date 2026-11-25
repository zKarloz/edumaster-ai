# CAMBIOS 21 — v30.2.12: Usuarios y navegación en recargas

## Alcance

- La pantalla **Importar usuarios desde CSV** elimina el encabezado y párrafo duplicados; el título permanece en el topbar compartido de la aplicación.
- El botón **Volver a Usuarios** se coloca al margen izquierdo, alineado con otras páginas de EduMaster.
- Una recarga del navegador en `/gestion/usuarios` o `/gestion/usuarios/importar-csv` conserva la ruta solicitada.
- El permiso de administración de usuarios se obtiene de los roles devueltos por `/api/v1/me`, sin depender de la carga asíncrona del catálogo de instituciones.
- Si un usuario autenticado intenta entrar a un módulo no autorizado, se muestra **Acceso restringido** sin montar el módulo ni redirigirlo silenciosamente a Resumen. FastAPI mantiene la autorización real de cada petición.

## Impacto

Solo frontend. Sin migraciones SQL, cambios en FastAPI, secretos nuevos ni paquetes npm adicionales. La validación de CSV, los lotes de 20 y el flujo de invitación no cambian.

## Pruebas de aceptación

1. Como superadministrador, entrar a **Usuarios** y pulsar Recargar del navegador: mantener la URL, el título del módulo y el directorio.
2. Ir a **Importar CSV**, pulsar Recargar y comprobar la misma ruta y la tabla de vista previa tras volver a validar un archivo (el archivo local se selecciona nuevamente por seguridad).
3. Comprobar que arriba de la página solo aparece **Volver a Usuarios**, alineado a la izquierda; el título permanece en el topbar.
4. Como administrador institucional autorizado, repetir las recargas.
5. Como usuario sin permisos, abrir una ruta de Usuarios directamente: no debe mostrarse la información del directorio ni poder llamarse a sus endpoints sin autorización.
6. `npm run build`, `npm run test:users`, `npm run test:editor`, `npm run test:tasks` deben finalizar correctamente.

> No se conserva en memoria el contenido seleccionado del CSV al recargar: el navegador requiere elegir de nuevo el archivo. No se envían correos al usar **Validar sin enviar**.
