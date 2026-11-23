# EduMaster.ai — CAMBIOS 3

**Base del parche:** Proyecto v3 (Login + superadmin). Aplicar sobre la versión
`EduMaster_Login_Superadmin_Proyecto_v3.zip` o un proyecto basado en esa versión.

## Qué se corrigió

1. **Tema Negro:** caja de búsqueda, icono, texto, placeholder y borde de foco
   en escala de grises.
2. **Tarjetas de advertencia:** ámbar menos saturado en Oscuro y gris cálido
   en Negro; se mantienen los colores de los estados importantes.
3. **Validación de sesión:** el frontend valida el JWT y el rol al iniciar sesión.
   Si Supabase renueva el token del mismo usuario mientras la pestaña recupera
   el foco, la revalidación en `/api/v1/me` se realiza sin reemplazar el
   dashboard por una pantalla de «Validando acceso». Si cambia el usuario,
   se cierra sesión o el servidor responde 401/403, el acceso se bloquea.

La autorización real permanece en FastAPI. No se omiten las comprobaciones
backend por conservar temporalmente el dashboard durante la renovación.

## Aplicación del parche

1. En VSCode, guarda una copia o haz commit de `apps/web/src`.
2. Descomprime el ZIP de parche en la carpeta **raíz** `edumaster-ai/`.
3. Reemplaza exclusivamente `apps/web/src/App.tsx` y
   `apps/web/src/styles.css`.
4. **No cambies** los `.env`, los archivos SQL ni el backend.
5. Desde Git Bash:

```bash
cd apps/web
npm run build
npm run dev
```

## Verificaciones manuales

- En Configuración → tema **Negro**, abre Instituciones y enfoca la búsqueda:
  el fondo y el borde deben ser grises.
- Con tema Oscuro y Negro, comprueba una advertencia: el ámbar debe ser tenue.
- Inicia sesión y alterna varias veces entre pestañas: el dashboard debería
  permanecer visible cuando Supabase renueva silenciosamente el token.
- Recarga la página: puede mostrarse brevemente «Recuperando sesión» y la
  primera validación de acceso, lo cual es normal.
- Cierra sesión: debe aparecer la pantalla de login.
- Si FastAPI devuelve 401/403 durante la revalidación, la UI debe bloquear
  los módulos, no mantener acceso indebido.

**Nota de pruebas:** se comprobó la sintaxis TSX y la presencia de reglas CSS;
la compilación completa debe verificarse en tu VSCode con dependencias npm instaladas.
