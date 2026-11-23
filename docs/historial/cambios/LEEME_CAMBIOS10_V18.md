# EduMaster.ai — CAMBIOS 10 / v18

Incremento visual y de internacionalización aplicado sobre v17, sin alterar las tablas SQL ni los flujos de permisos.

## Resumen funcional

1. **Tarjetas indicadoras** del dashboard con elevación sutil al pasar el cursor. Se desactiva por preferencia de animaciones y por `prefers-reduced-motion`.
2. **Tres idiomas**: español (`es`), inglés (`en`) y portugués de Brasil (`pt`, HTML `pt-BR`). Diccionarios `i18next`/`react-i18next` por pantalla, selector en Login y Configuración, traducciones de navegación, formulario, tablas y atributos accesibles; formatos regionales en los indicadores académicos. Los textos procedentes del backend siguen su idioma de origen hasta una fase posterior de localización de mensajes de API.
3. **Topbar simplificado**: sin tarjeta permanente «API conectada». En Configuración hay una sección Estado del sistema y un botón para consultar `/health` manualmente.
4. **Sidebar**: control ubicado al pie; tres modos: Expandido, Colapsado y Dinámico (superposición al cursor o foco). En móvil sigue el cajón tradicional. Preferencia local separada por identidad de Supabase Auth.
5. **Login**: correo y contraseña utilizan el mismo panel de control, incluso en temas Oscuro y Negro.
6. **Navegación agrupada**: PLATAFORMA, GESTIÓN, ACADÉMICO y SISTEMA; las categorías vacías se omiten y, al colapsar, su etiqueta pasa a ser `-`. Perfil continúa en el menú de cuenta.
7. **Rutas sin `/app`**: `/inicio`, `/gestion/*`, `/academico/*`, `/sistema/*`, `/cuenta/perfil`. Redirección de URLs antiguas, incluidos historiales académicos individuales y parámetros de búsqueda.
8. **Idioma del perfil**: nuevo `PATCH /api/v1/me/language` autenticado que solo guarda `language_code` (`es`, `en`, `pt`). No sobrescribe país, fecha de nacimiento, sexo ni consentimiento de privacidad. Se registra auditoría. **No hay migración SQL**.

## Instalación incremental desde la v17

1. Guarda tu trabajo y una copia del proyecto.
2. Extrae el ZIP **Parche v18** en la carpeta que contiene `edumaster-ai`, preservando rutas, sin sobrescribir `.env`.
3. Desde `apps/api` ejecuta:

   ```bash
   python -m ruff check app tests
   python -m pytest -q
   ```

4. Desde `apps/web` ejecuta **obligatoriamente** (se agregan dos dependencias):

   ```bash
   npm install
   npm run build
   npm run dev
   ```

5. Solo si Ruff y la compilación web pasan, desde la raíz de Git:

   ```bash
   git status
   git add apps/api apps/web LEEME_CAMBIOS10_V18.md
   git commit -m "feat(interfaz): incorporar tres idiomas y reorganizar la navegación"
   git push origin main
   ```

6. GitHub CI ejecutará ambas comprobaciones; Vercel (React) y Render (FastAPI) se publicarán mediante su despliegue automático. La nueva interfaz puede publicarse antes que el nuevo endpoint de Render: en ese intervalo el idioma seguirá funcionando localmente pero no se guardará en el perfil hasta que FastAPI v18 esté activo.

## Pruebas recomendadas

- Abrir la plataforma en inglés y portugués desde el Login, y cambiar otra vez desde Configuración. Comprobar navegación, tablas, principales formularios y modales; algunas respuestas de error devueltas por FastAPI continuarán en español por ahora.
- Iniciar sesión como estudiante, docente y administrador de dos instituciones: ocultación de categorías sin autorización y mantenimiento de permisos backend.
- Cambiar Expandido, Colapsado y Dinámico; verificar el efecto al pasar el cursor, navegar con Tab, cerrar mediante Escape y usar el menú en móvil.
- Guardar idioma en Configuración, recargar, iniciar sesión desde otro navegador y verificar la persistencia. Cambiar idioma en Perfil no debe borrar país/sexo/fecha de nacimiento.
- Verificar que `/app/cursos`, `/app/perfil` y un historial de matrícula v17 redirigen a las rutas nuevas, conservando búsqueda y hash.
- Probar cada tema, movimiento desactivado y `prefers-reduced-motion`; comparar fondo de correo y contraseña en Login.
- Confirmar que `/health` solo aparece en Configuración, no en la cabecera.

## Verificación realizada para este parche

- FastAPI: **151 pruebas** pasan (140 anteriores + 11 nuevas). No se ejecutan consultas contra el Supabase real durante esas pruebas.
- TypeScript/TSX: se analizó la **sintaxis** de 33 archivos y se comprobó igualdad de claves entre diccionarios ES/EN/PT.
- Rutas: pruebas manuales locales de redirección de rutas y enlaces profundos correctas.
- No se pudo ejecutar `npm run build` completo en este entorno por falta de instalación de dependencias npm. **Es obligatorio hacerlo localmente y confirmar CI antes del despliegue**.
- Las comprobaciones reales de persistencia de idioma, accesibilidad y estilo visual deben validarse desde navegador y Supabase tras la instalación.

## Notas sobre privacidad y arquitectura

Las preferencias del sidebar, tema y animación se guardan por usuario en almacenamiento local del navegador. El idioma además se guarda en `app.user_profile_details.language_code` a través de FastAPI autenticado. La API sigue autorizando operaciones mediante JWT, membresía institucional y controles del servidor: ocultar un enlace no constituye un permiso.

No se agrega ninguna clave privada en el frontend y no se necesitan modificaciones de Render, Vercel ni SQL.
