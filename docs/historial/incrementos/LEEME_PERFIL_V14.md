# EduMaster.ai v14 — Perfil y menú de cuenta

Parche incremental sobre v13.1. Conservar `.env`, `.venv`, `node_modules` y datos existentes.

## 1. Configurar Storage (solo una vez, para las fotos)
En Supabase → Storage → New bucket, crear `profile-avatars` **privado** (Public bucket desactivado). Configurar límite de tamaño 256 KB (262144 bytes) y tipo permitido `image/jpeg`. La aplicación convierte localmente las fotos JPG, PNG o WebP de hasta 5 MB en JPEG cuadrado de 384 × 384, sin enviar el original. El bucket privado contiene únicamente `<auth.uid()>/avatar.jpg`.

En SQL Editor ejecutar `database/migrations/003_avatar_policies.sql`. No repetir 001/002 ni activar Data API. Revisar que no existan otras políticas generales de Storage que otorguen acceso a este bucket: las políticas permisivas de PostgreSQL se combinan con OR. Las cuatro políticas nuevas limitan los archivos al UUID de la propia identidad autenticada. El avatar se descarga con el JWT y se muestra con una URL Blob temporal; no se crea un enlace público. Como Storage es independiente del directorio académico, estas políticas protegen la propiedad por cuenta Auth, no los roles institucionales.

El nombre se actualiza en app.users, utilizando el endpoint PATCH /api/v1/me/profile. No hay nuevas tablas del esquema app. El cambio de nombre se audita; no se guardan contraseñas en app.users. Las fotos se guardan en Storage, no en localStorage.

## 2. Instalar
Descomprimir el parche en la carpeta que contiene edumaster-ai. Aceptar reemplazos. Reiniciar la API:

```bash
cd apps/api
source .venv/Scripts/activate
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd apps/web
npm install
npm run build
npm run dev
```

Se requiere actualizar @supabase/supabase-js a >=2.102.0 (declarado en package.json) por el parámetro oficial `current_password` de updateUser. Usar Node compatible con las dependencias instaladas (Node 22 LTS actualizado). No se requieren claves nuevas.

## 3. Contraseñas
En Supabase Auth, configuración del proveedor Email/password, habilitar **Require current password when changing password** si está disponible en tu proyecto; mantener la política de contraseñas segura. El formulario envía la contraseña actual al SDK de Supabase y solicita nueva contraseña con confirmación; no pasa por FastAPI. Si se requiere reautenticación adicional, el usuario puede solicitar un código, sujeto a la configuración y límites de correo de Supabase. Este incremento implementa cambio de contraseña autenticado, no recuperación de acceso desde el login cuando la contraseña se ha olvidado.

## 4. Pruebas manuales
- Inicio de sesión y menú de cuenta: nombre y correo correctos; avatar sin foto (dos primeras letras, color estable por UUID); abrir/cerrar con clic exterior y Escape; comprobar tema claro, oscuro y negro y animaciones desactivadas.
- Perfil: cambiar nombre, comprobar cabecera y directorio académico después de recargar. Correo de solo lectura.
- Cargar y quitar foto; recargar la página; cerrar sesión e iniciar con otra cuenta (no debe mostrarse el avatar anterior). Probar con una foto mayor de 5 MB y un archivo no permitido.
- Probar cambio de contraseña en una cuenta DEMO, no en la única cuenta superadmin. Contraseña actual errónea debe rechazarse; nueva contraseña correcta debe funcionar en otro inicio de sesión. Si exige OTP, solicitarlo y verificarlo.
- Probar que un JWT de una cuenta A no puede descargar o sobrescribir el objeto de B.

## 5. Verificación disponible
94 pruebas FastAPI aprobadas (con base simulada); comprobación de sintaxis TS/TSX. npm install no terminó por conectividad; build completo, pruebas de políticas en Supabase y cambio de contraseña real pendientes en tu instalación. No se ha accedido a tu proyecto Supabase.
