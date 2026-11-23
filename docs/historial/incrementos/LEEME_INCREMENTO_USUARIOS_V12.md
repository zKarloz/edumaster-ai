# EduMaster.ai · Incremento Usuarios v12

## Qué incorpora

- Nuevo módulo **Usuarios** para cuentas con rol global `superadmin`.
- Listado paginado y buscable de administradores institucionales, filtro por institución, resumen de asignaciones.
- Formulario modal para **asignar** `institution_admin` a una cuenta **ya existente y confirmada** en Supabase Auth. El rol es fijo, con revisión de los datos y confirmación antes de guardar.
- Revocación de `institution_admin` con confirmación, manteniendo la identidad global y cualesquiera otros roles institucionales.
- Auditoría de concesión/revocación, protección contra duplicados y contra la revocación del **último administrador activo**.
- El `superadmin` **no gestiona operaciones académicas rutinarias**: crear cursos y administrar estudiantes/matrículas exige rol de gestor institucional (`institution_admin` o `coordinator`).

## Aplicar el parche

1. Haz copia de seguridad de tu repositorio.
2. Extrae el ZIP de parche conservando las rutas `edumaster-ai/...` y sobreescribe únicamente sus archivos.
3. **No** sustituyas tus `.env`. **No** vuelvas a ejecutar `001_initial_schema.sql` ni la migración 002. Este incremento no requiere SQL.
4. Inicia backend en `apps/api` con `.venv` activo:

   ```bash
   python -m pytest -q
   python -m uvicorn app.main:app --reload --port 8000
   ```

5. Inicia frontend desde `apps/web`:

   ```bash
   npm run build
   npm run dev
   ```

   No se añadieron dependencias npm nuevas.

## Prueba de extremo a extremo con Lima y México

1. En Supabase **Authentication → Users** crea una cuenta de prueba bajo tu control con correo confirmado. **No incluyas su contraseña en el chat** ni uses contraseñas compartidas en producción.
2. Inicia EduMaster.ai con tu `superadmin` existente. Abre **Usuarios → Asignar administrador**.
3. Selecciona la institución de Lima, introduce el correo, acepta la confirmación y pulsa **Revisar asignación → Confirmar asignación**.
4. La tabla debe mostrar la nueva asignación. Si repites el alta, API responderá `409` sin crear duplicados.
5. Cierra sesión y entra con la segunda cuenta: `GET /api/v1/me` debería devolver `institution_admin` únicamente en la membresía de Lima.
6. Como administrador institucional, abre **Cursos**: podrás crear cursos en Lima. No deberías poder crear cursos en México ni asignar roles globales.
7. Vuelve a la cuenta superadmin. Asigna otro administrador a Lima si deseas probar revocaciones; no se permite revocar al único administrador activo.

## Errores esperados

- **401:** token faltante o no válido.
- **403:** falta el rol `superadmin` para administrar asignaciones.
- **404:** institución/asignación no disponible.
- **409:** duplicado, membresía suspendida, usuario no activo o intento de revocar al último administrador.
- **422:** correo incorrecto, cuenta no confirmada en Supabase Auth o payload no permitido.
- **503:** fallo de base de datos; inspeccionar la terminal de FastAPI.

## Límites deliberados

- No se invitan usuarios automáticamente: se **vincula una cuenta Auth existente y confirmada**, como aprobamos para esta primera etapa.
- No se implementa suspensión ni asignación de otros roles institucionales desde esta pantalla; corresponderá a la etapa siguiente.
- La lista del backend está limitada a 500 asignaciones, con búsqueda/paginación local en la interfaz. Más adelante incorporaremos paginación del servidor.
- La protección del último administrador está en el backend y la transacción bloquea la fila de la institución. Para una auditoría de concurrencia real se necesitan pruebas de integración contra PostgreSQL.
- Mantener credenciales y claves secretas **exclusivamente fuera del frontend**. El proyecto conserva Auth en Supabase, datos en el esquema privado `app` y la autorización en FastAPI.
