# CAMBIOS 21 — v30.2.11 · Directorio de usuarios y CSV

**Base:** CAMBIOS 21 v30.2.10 (posterior a v30.2.9).

## Correcciones

1. El directorio de superadministrador obtiene la institución activa a partir de la lista **ya cargada** de instituciones autorizadas, en vez de almacenar el primer ID (vacío al recargar el navegador). Se distingue carga y error de consulta de un directorio realmente vacío.
2. La opción **Importar CSV** abre la página `/gestion/usuarios/importar-csv` en el módulo Usuarios. El selector de institución respeta el alcance administrativo; una institución en la URL solo es una preferencia, no una autorización.
3. La página permite elegir el archivo CSV, validar sin enviar invitaciones, examinar todas las filas en una tabla compartida y confirmar explícitamente el envío por lotes de veinte. Conserva los resultados por fila y no reintenta automáticamente un lote si falla la conexión.
4. La tabla compartida `DataTable` ofrece **5, 10 y 20 filas por página** e inicia siempre con cinco en su paginación local. Al cambiar el tamaño o el filtro de búsqueda regresa a la primera página. Las tablas que usan `manualMode` conservan su paginación desde el servidor.
5. La invitación individual continúa usando el modal compartido; no se alteran permisos ni el sistema de autenticación.
6. El paquete completo incluye los dos arreglos de Ruff que ya se hicieron localmente en v30.2.10 (orden de importaciones y `removeprefix`); si ya están aplicados, no se reemplazan.

## Seguridad

- Las operaciones siguen pasando por FastAPI, que verifica token, institución, función y límites del lote.
- La previsualización no envía correos. El envío masivo requiere confirmación.
- No se muestran claves administrativas ni se registran contraseñas.
- Antes de grandes importaciones debe configurarse y probarse SMTP, y respetarse la cuota de invitaciones del proveedor.

## Validación

En `apps/web` ejecutar:

```bash
npm run build
npm run test:users
npm run test:editor
npm run test:tasks
```

Como superadministrador recargar directamente `/gestion/usuarios` y comprobar que el directorio se mantiene visible. Abrir Importar CSV, recargar su URL, previsualizar al menos once filas y cambiar tamaño a 5, 10 y 20 sin enviar invitaciones. Repetir bajo el tema Claro, Oscuro y Negro. Como administrador institucional comprobar que solo ve su institución.

**No se ejecuta SQL ni se modifica Supabase Auth durante la instalación.**
