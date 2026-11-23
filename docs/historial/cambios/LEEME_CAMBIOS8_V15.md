# EduMaster.ai · CAMBIOS 8 (v15)

Esta versión es un **parche incremental sobre v14**. Respeta tus instituciones, usuarios, cursos y credenciales ya configuradas.

## 1. Instalación

1. Haz una copia de seguridad del proyecto.
2. Descomprime el ZIP del parche en **la carpeta que contiene `edumaster-ai`**, respetando la estructura. No copies archivos `.env` ni vuelvas a ejecutar 001, 002 o 003.
3. En Supabase → SQL Editor, ejecuta **solo** `database/migrations/004_profile_details_and_avatar_visibility.sql` una vez, con la cuenta administrativa de la base de datos. Debe existir el bucket privado `profile-avatars` y las políticas de 003.
4. Verifica:

```sql
SELECT tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'app'
  AND tablename = 'user_profile_details';
-- Esperado: user_profile_details | true

SELECT policyname FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname='edumaster_avatar_admin_read';
-- Esperado: 1 fila
```

5. Reinicia FastAPI y React:

```bash
# Terminal 1 · desde edumaster-ai/apps/api
source .venv/Scripts/activate
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 · desde edumaster-ai/apps/web
npm run build
npm run dev
```

No se han agregado dependencias ni variables de entorno. `npm run build` debe ejecutarse en tu equipo (no se pudo instalar npm aquí por problemas de red).

## 2. Qué incorpora

- `UserAvatar` muestra el `Spinner` compartido hasta comprobar si hay foto; entrada visual suave al cargarla y respeto de la preferencia global de animaciones.
- `Validando acceso` muestra el avatar propio de Supabase Auth. No necesita esperar a que cargue la lista de instituciones.
- `Perfil → Seguridad de la cuenta` es una tarjeta que abre el modal compartido para cambiar la contraseña con comprobación de la contraseña actual.
- `Perfil → Datos personales adicionales` permite guardar idioma, país ISO, fecha de nacimiento, sexo y consentimiento voluntario para mostrar país e idioma a administradores.
- Las vistas global e institucional de `Usuarios` incorporan el botón `···` para consultar una ficha autorizada con avatar, nombre, correo, organización, roles, estado y (con consentimiento) país e idioma.
- Los campos sensibles **sexo y fecha de nacimiento no se comparten en el directorio de administradores**.
- Nuevas rutas FastAPI: `GET/PATCH /api/v1/me/details` y `GET /api/v1/directory/users/{user_id}?organization_id=<uuid>`. Los accesos requieren JWT válido y validación de institución y rol en SQL.
- Nuevo esquema privado `app.user_profile_details` y política de Storage que permite leer fotos privadas solo al titular y administradores autorizados.

## 3. Nota importante sobre contraseñas históricas

Supabase Auth soporta verificar **la contraseña actual** para cambiarla y no aceptar como nueva la misma contraseña, pero **no ofrece en su configuración estándar una política nativa para impedir la reutilización de cualquier contraseña histórica**. No almacenamos contraseñas ni hashes en React ni simulamos esta protección. La prohibición histórica necesita una solución centralizada que cubra también los restablecimientos y cambios externos a la aplicación; queda pendiente para la etapa de endurecimiento de autenticación. Para reforzar la seguridad actual, activa en Supabase Auth `Require current password when changing password` y usa contraseñas largas/únicas y MFA cuando sea posible.

Referencia: https://supabase.com/docs/guides/auth/password-security

## 4. Pruebas recomendadas en tu Supabase

- Subir una foto y actualizar la página. Debe mostrarse el spinner hasta terminar la descarga, seguido de la foto con desvanecimiento.
- Quitar la foto. Deben quedar las dos primeras letras del nombre con color estable.
- Cerrar sesión e iniciar sesión de nuevo. En «Validando acceso» debe verse el avatar (o spinner mientras carga).
- Abrir el modal de contraseña desde la tarjeta de Seguridad y probar con **una cuenta DEMO**, no con tu único superadministrador.
- Como administrador institucional de Lima, abrir `Usuarios → ···` sobre un usuario de Lima. Verificar foto, rol y datos disponibles.
- Desde esa cuenta intentar consultar en la API un perfil de un usuario de México: debe devolver 404 si no comparte institución.
- En Perfil completar país e idioma y dejar desactivado el consentimiento: la ficha administrativa dirá «No compartido». Activarlo y volver a consultar: mostrará esos dos campos. Fecha de nacimiento y sexo continuarán privados.
- Cambiar entre Claro, Oscuro y Negro y desactivar animaciones desde Configuración.

## 5. Arquitectura y privacidad

- Los IDs de usuario en las listas son IDs internos `app.users.id`. Las fotos utilizan `auth.users.id`; FastAPI vincula ambas identidades sin confiar en IDs arbitrarios del navegador.
- La migración concede a `authenticated` permiso para **ejecutar una única función de autorización** sobre el esquema privado `app`, sin otorgar `SELECT` de las tablas.
- Las fotos no se vuelven públicas. El acceso a Storage se comprueba en RLS con el usuario autenticado y su rol/membresía activa.
- La ficha administrativa solo contiene los campos estrictamente necesarios; los atributos íntimos permanecen en el perfil personal.
