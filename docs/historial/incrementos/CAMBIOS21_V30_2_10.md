# CAMBIOS 21 — v30.2.10: altas e importación de usuarios

Base de código: v30.2.9. **No se necesita migración SQL**: se reutilizan `auth.users`, `app.users`, `app.organization_memberships`, `app.membership_roles`, `app.students`, `app.instructors` y `app.audit_logs`.

## Roles y alcance

- Superadministrador activo: invita estudiantes, docentes, coordinadores, analistas e ingenieros ML, y también administradores institucionales; siempre eligiendo la organización.
- Administrador institucional activo: invita únicamente los cinco roles delegables dentro de su institución.
- Docentes, estudiantes y otros roles: acceso prohibido. Toda ruta verifica JWT en FastAPI y roles en PostgreSQL.
- No se crean superadministradores por esta interfaz, no se generan contraseñas para terceros y ninguna clave privada se entrega a React.

## Acceso y activación

1. En **Usuarios**, seleccionar institución y pulsar **Invitar usuario** o **Importar CSV**.
2. FastAPI verifica el rol, la institución activa y la inexistencia del correo en `auth.users` y `app.users`.
3. FastAPI solicita una invitación a Supabase Auth utilizando `SUPABASE_SECRET_KEY` únicamente desde el servidor.
4. Al recibir respuesta de Auth, el backend registra el perfil, la membresía, el rol y el perfil académico en una transacción SQL; audita la acción sin registrar secretos.
5. El destinatario abre el correo. Se dirige a la URL configurada en **Authentication → URL Configuration → Site URL / Redirect URLs** y define su propia contraseña (mínimo 12 caracteres) en EduMaster.
6. Las membresías se vinculan como activas para que puedan usarse al finalizar el enlace de Auth. El directorio **muestra «Invitado» mientras `auth.users.email_confirmed_at` sea nulo**.
7. Usuarios que YA existan en Auth y estén confirmados: usar la opción existente **Incorporar usuario** / **Asignar administrador**. El flujo de invitación no reasigna identidades existentes silenciosamente.

## CSV (UTF-8)

Encabezado obligatorio: `email,full_name,role`, con comillas dobles si el nombre contiene una coma.

- Validación previa del CSV sin enviar correos (máximo 96 KB y 300 filas).
- Se revisan nombres, direcciones, roles y correos repetidos.
- Si hay errores, se bloquea toda la importación hasta corregirlos.
- Tras confirmación explícita, la interfaz envía **20 filas por lote**, con estado individual `invited`/`error`.
- Tras interrupción de red no se reintenta automáticamente, porque la operación externa en Supabase Auth podría haberse completado. Antes de insistir se comprueba la existencia de la cuenta.
- Una invitación enviada y una transacción SQL fallida NO son transaccionales entre servicios. El backend notifica la necesidad de revisión administrativa; no borra automáticamente una identidad de Auth ni invita otra vez para ocultar la inconsistencia.

**Correo saliente**: con el proveedor integrado de Supabase Auth, la cuota publicada es de unas **2 invitaciones por hora por proyecto**, y se restringen los destinatarios. Configurar **SMTP propio** o un servicio de correo compatible (y sus límites) antes de enviar cientos de invitaciones reales. Para un dataset ML DEMO se crearán registros sintéticos **sin cuentas de Auth ni correo real** en un futuro incremento aislado.

## Seguridad y operación

- Antes de probar: URL pública HTTPS de frontend configurada como `Site URL`; claves `SUPABASE_URL` y `SUPABASE_SECRET_KEY` solo en `apps/api/.env` y Render.
- La clave `sb_secret_...` se envía únicamente como `apikey`, no `Authorization: Bearer sb_secret_...`. Clave legacy `service_role` JWT puede usar Bearer.
- Los datos de CSV deben corresponder a usuarios legítimos; no usar direcciones de estudiantes reales sin autorización institucional.
- No usar el lote completo para probar: comenzar con **un correo propio de prueba**, verificar invitación, activación, matrícula/perfil y acceso a la institución correcta. Intentar lo mismo con un docente no autorizado y con otra institución; el backend debe rechazarlo.
- Para prevenir duplicados, el correo debe ser único en Auth y en el registro global. No borrar cuentas invitadas si otras instituciones pueden tener referencias.

## Pruebas y operaciones

```
# Desde apps/api
python -m ruff check app tests
python -m pytest -q
python ../../tools/verificacion/verificar_invitaciones_v30_2_10.py

# Desde apps/web
npm run build
npm run test:editor
npm run test:tasks
npm run test:users
```

No ejecutar SQL nuevo. No subir credenciales, `.env` o CSV reales al repositorio.
