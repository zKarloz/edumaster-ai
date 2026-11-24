# CAMBIOS 20 · v29.1 · Revisión E — protección de navegación y cierre de sesión

> **NO INSTALAR. NO EJECUTAR MIGRACIÓN 009. NO DESPLEGAR.** Rama técnica de revisión derivada de v28 (`3895ed3`) y revisiones A–D.

## Cambios de esta revisión

1. `apps/web/src/main.tsx`: sustituye el enrutador declarativo `BrowserRouter` por `createBrowserRouter` + `RouterProvider`, conservando todas las URLs y el componente raíz `App`. Esto habilita `useBlocker` según la API de React Router 7.
2. `apps/web/src/modules/academic/LessonEditorPage.tsx`: utiliza el bloqueo de navegación nativo de React Router para impedir pérdidas de borrador en menú, enlaces, rutas profundas, Atrás/Adelante e incluso cambios de query/hash. El `Modal` compartido permite cancelar o descartar. `beforeunload` sigue protegiendo recarga/cierre de pestaña.
3. `apps/web/src/App.tsx`: el cierre de sesión comprueba si el editor tiene cambios pendientes **antes** de llamar a Supabase Auth. El editor muestra el modal y puede confirmar un cierre de sesión sin guardar. Un fallo de Supabase restablece el bloqueo del editor.
4. `apps/web/src/modules/academic/lessonNavigation.ts`: función pura con las reglas de bloqueo (pruebas independientes del navegador).
5. `apps/web/src/i18n.ts`: textos específicos para descartar cambios en ES/EN/PT.
6. `apps/web/tests/lesson-navigation.test.cjs`: seis casos nuevos que verifican cambios de ruta, búsqueda, hash y cierre confirmado.
7. `apps/api/tests/test_cambios20_router_auth_v29_1.py`: seis casos que comprueban que GET, POST y PATCH de ambos tipos de lección requieren autenticación antes de acceder a PostgreSQL.
8. `docs/diseno/009_postflight_lectura.sql`: añade un diagnóstico **solo de lectura** de permisos sobre la tabla nueva, sin confundir la sesión del editor SQL con la conexión de FastAPI.

## Estado de verificación

- `python -m pytest -q` desde `apps/api`: **261 passed**.
- `NODE_PATH=<directorio global typescript> npm run test:editor` en entorno de preparación: **14 passed**. En VSCode, con dependencias locales, no se requiere `NODE_PATH`.
- Se analizaron 42 archivos `.ts`/`.tsx` sintácticamente mediante el parser TypeScript global: **0 errores de sintaxis**. Esto **no equivale** al chequeo de tipos `tsc -b`.
- **No verificado en este entorno:** instalación npm, `npm run build`, Ruff, navegación en navegador, PostgreSQL real, privilegios después de ejecutar 009, consultas de estudiantes después del backfill y flujos completos autenticados.
- No se ha modificado Supabase, ni GitHub, ni el proyecto local del usuario.

## Validación que falta antes de declarar v29.1 instalable

1. Crear **copia de desarrollo** del proyecto v28, sin reemplazar los archivos locales originales.
2. En esa copia, instalar dependencias npm, generar lockfile reproducible, `npm run test:editor`, `npm run build`; ejecutar `python -m ruff check app tests` y `python -m pytest -q`.
3. Probar visualmente los tres temas e idiomas y los siguientes escenarios con una lección editada sin guardar: menú lateral, botón Volver, enlace interno, Atrás, Adelante, cierre de sesión (cancelar y confirmar), recarga, cierre de pestaña.
4. En una **base PostgreSQL de pruebas**, validar `009_preflight_lectura.sql`, plan de respaldo, migración 009 y `009_postflight_lectura.sql` con el rol del servicio FastAPI.
5. Verificar transacciones autenticadas HTTP para gestor, docente asignado, estudiante y acceso interinstitucional (403, 404, 409), y confirmar que el contenido visible a estudiantes no cambia al guardar borradores.
6. Solo cuando todas estas pruebas pasen, preparar el instalador incremental para Windows Git Bash con tolerancia a LF/CRLF, copia de seguridad, despliegue coordinado de base, backend y frontend, y sin SQL automático.

### Precaución de versionado

La migración 009 y las revisiones A–D continúan **en revisión**. Esta revisión E no propone cambios destructivos de tablas. La futura publicación enriquecida, historial restaurable y archivos privados pertenecen a entregas posteriores.
