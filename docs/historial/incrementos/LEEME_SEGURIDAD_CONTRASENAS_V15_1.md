# EduMaster.ai · Seguridad de contraseña, corrección v15.1

## Causa del fallo

En v15, `PasswordDialog.tsx` enviaba `current_password` a `supabase.auth.updateUser()`, pero **ese campo no fuerza por sí solo** a Supabase Auth a comprobarlo. Si la política de servidor `Require current password when changing password` no está habilitada, el backend de Supabase permite la actualización basándose únicamente en la sesión autenticada. El formulario comparaba la nueva contraseña con el texto escrito como "contraseña actual", una validación local que no confirma que sea la contraseña real.

El SQL 004 solo protege atributos de perfil y fotografías: **no interviene en Supabase Authentication**. Tampoco establece un historial de contraseñas.

## Acción OBLIGATORIA en Supabase (no basta con instalar el parche)

Supabase Dashboard → **Authentication → Sign In / Providers → Email** (en algunas versiones `Authentication → Providers → Email`):

1. Activa **Require current password when updating** / **Require current password when changing password**.
2. Considera habilitar **Secure password change** / **Require reauthentication when changing password** para exigir un código de confirmación si la sesión no es reciente. **Son opciones distintas**.
3. Guarda los cambios y cierra e inicia sesión normalmente para probar. No utilices una sesión de recuperación de contraseña, que tiene reglas especiales.
4. Configura además políticas de longitud/fortaleza, rate limiting y MFA para cuentas administrativas.

**Importante**: la validación en el navegador puede eludirse mediante llamadas directas a Supabase Auth. Por eso, la política del servidor es indispensable.

## Qué aporta el parche

- Antes de invocar `updateUser`, verifica la contraseña actual mediante `signInWithPassword` contra Supabase Auth en **otro cliente aislado**, sin almacenar la sesión en el navegador ni reemplazar la sesión del usuario.
- Si la verificación falla o Auth no responde, no se intenta cambiar la contraseña (fail-closed).
- El cliente temporal cierra solo SU sesión temporal con `scope: 'local'`.
- Sigue enviando `current_password` a `updateUser` para que el servidor lo compruebe **cuando esté habilitada la política**.
- No almacena contraseñas, tokens ni hashes en `app.*`, ni en `localStorage`, ni en el backend propio.
- **No bloquea el historial completo de contraseñas**: Supabase Auth estándar impide repetir la contraseña vigente, pero no recuerda todas las anteriores. No se debe prometer lo contrario.

## Instalación

1. Copia de seguridad de `apps/web/src/modules/profile/PasswordDialog.tsx`.
2. Descomprime este parche en la carpeta que **contiene** `edumaster-ai`, preservando las rutas.
3. No cambies `.env`, no ejecutes SQL adicional y no modifiques FastAPI.
4. En `apps/web` ejecuta:

```bash
npm run build
npm run dev
```

## Prueba segura con cuenta DEMO

1. Inicia sesión normalmente con una cuenta de prueba de Supabase Auth.
2. Abre Perfil → Seguridad de la cuenta.
3. Escribe una **contraseña actual incorrecta** y una nueva distinta: **debe rechazarla** y la contraseña vigente debe continuar funcionando.
4. Escribe la contraseña actual correcta y una nueva distinta y robusta: el cambio puede completarse si la política de Supabase y la sesión lo permiten.
5. Confirma el inicio de sesión con la nueva contraseña, preferentemente desde una ventana privada.
6. Intenta usar la contraseña anterior inmediatamente: debe ser rechazada como contraseña vigente del usuario; esto **no demuestra bloqueo de reutilización histórica**.
7. No pruebes repetidamente el cambio de contraseña en la cuenta única de superadministración.

## Si el servidor sigue aceptando una contraseña actual incorrecta

- Confirma que habilitaste **Require current password** y no solo **Secure password change**.
- Comprueba que `npm ls @supabase/supabase-js` muestra al menos **2.102.0**.
- En DevTools → Network, inspecciona **en privado**, sin copiar secretos, si la petición `PUT /auth/v1/user` incluye `current_password` (no compartas su valor).
- Si la política está activa y la petición contiene el campo correcto pero la operación acepta un valor erróneo, detén la prueba y revisa el caso con soporte de Supabase.

## Notas sobre historial de contraseñas

El almacenamiento de hashes de contraseñas históricas en tablas `app.*` o en el navegador no sería una solución correcta ni suficiente para todos los flujos (restablecimiento de contraseña, cambios externos, etc.). Para bloquear historial real deberá seleccionarse una estrategia centralizada que cubra todos los cambios de Supabase Auth. Hasta entonces se documenta como limitación, no como funcionalidad terminada.

Referencias:
- https://supabase.com/docs/guides/auth/password-security
- https://supabase.com/docs/guides/auth/passwords
- https://github.com/supabase/auth/blob/master/internal/api/user.go
