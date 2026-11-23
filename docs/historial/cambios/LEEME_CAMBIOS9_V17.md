# EduMaster.ai · CAMBIOS 9 · v17

## Objetivo y criterio académico

Este incremento distingue **curso** (catálogo), **oferta académica** (período y estado) y **matrícula** (avance/estado PERSONAL). No etiqueta a un curso como "completado" únicamente por estar cerrada una oferta.

Se implementa:

1. `PasswordInput` con botón mostrar/ocultar para Login y el modal de contraseña; no cambia las políticas de Supabase Auth.
2. Navegación con `BrowserRouter` y URLs `/app/...`. Se admiten enlaces directos a evidencias individuales por institución, oferta y matrícula. FastAPI continúa siendo la autoridad de permisos.
3. Cursos en **Lista** o **Cuadrícula**, filtrados por período, año indicado, oferta abierta y estado; catálogo por rol:
   - Estudiante: **Mis cursos** = matrículas personales; filtros En curso / Completados / Retirados.
   - Docente: ofertas que tiene asignadas (no “completados personales”).
   - Gestores: ofertas de la institución, con estados Planificada / Abierta / Cerrada / Cancelada.
4. Actividad: primero lista de estudiantes de la oferta. Clic en el nombre → ruta individual con métricas e historial de evidencias paginado desde FastAPI (10 por página), filtrable por tipo.
5. `DataTable` admite `manualMode` cuando la API ya pagina para evitar mostrar buscador/paginador duplicados o engañosos.

## Instalación — orden para GitHub + Render + Vercel

**No hay migración SQL 006**, se reutilizan las tablas existentes de la v16. Mantén las migraciones 001–005 aplicadas.

1. Haz una copia del proyecto y descomprime el parche en la carpeta que contiene `edumaster-ai`, **no** dentro de `apps/web`.
2. Abre Git Bash en `edumaster-ai/apps/api`:

   ```bash
   source .venv/Scripts/activate
   python -m ruff check app tests
   python -m pytest -q
   ```

   Se esperan **140 pruebas**. Si Ruff detecta orden de importaciones: `python -m ruff check app tests --fix`, y vuelve a probar.

3. En `edumaster-ai/apps/web` instala la dependencia nueva **React Router** y compila:

   ```bash
   npm install
   npm run build
   ```

   El `npm install` genera/actualiza `package-lock.json` cuando corresponde: súbelo también para que CI use la misma resolución de dependencias.

4. Desde la raíz del repositorio:

   ```bash
   git status
   git add apps/api apps/web LEEME_CAMBIOS9_V17.md
   git commit -m "feat(academico): organizar cursos por rol e historiales por matrícula"
   git push origin main
   ```

   GitHub Actions verificará el backend y el frontend. Render y Vercel pueden publicar automáticamente al detectar el nuevo commit.

## Rutas

- `/app/inicio`
- `/app/instituciones`
- `/app/usuarios`
- `/app/cursos`
- `/app/estudiantes`
- `/app/matriculas`
- `/app/actividad`
- `/app/seguridad`
- `/app/configuracion`
- `/app/perfil`
- `/app/actividad/organizaciones/:orgId/ofertas/:ofertaId/matriculas/:matriculaId`

La configuración `apps/web/vercel.json` ya permite recargar estas rutas desde Vercel. Una URL por sí sola **no concede acceso**; se exige JWT y ámbito institucional en la API.

## Pruebas funcionales recomendadas

- Login: mostrar/ocultar contraseña y confirmar que no cambia al enviar el formulario.
- Navegación: abrir `/app/cursos`, recargar y utilizar Atrás/Adelante del navegador.
- Como estudiante: comprobar `En curso`, `Completados` y `Retirados`; una oferta cerrada **no** convierte la matrícula en completada.
- Como docente: ver solo sus ofertas asignadas; jamás el listado administrativo de otro tenant.
- Como gestor: comparar Lista/Cuadrícula y filtrar por oferta/periodo; comprobar cursos históricos.
- Actividad: seleccionar una oferta → clic en un estudiante → probar filtro por tipo, paginador y botón volver. No se descargan 500 evidencias de toda la oferta.
- Abrir en otra sesión una URL del historial desde una cuenta sin permiso: FastAPI debe devolver **403 o 404**.

## Límites conocidos / próximas mejoras

- Los períodos son cadenas como `2026-II`, sin fechas académicas formales. `Año actual` filtra por el año contenido en el identificador de período; `Actuales` equivale a ofertas abiertas (y matrícula activa para el estudiante). No se infieren fechas inexistentes.
- El endpoint docente de ofertas ya existente limita a 200; se conserva ese límite hasta incorporar paginación propia. El resumen de estudiantes de una oferta mantiene límite de 500 por ahora, pero **el historial de evidencias ahora se pagina en SQL**.
- No se añadió visualización de anulaciones archivadas; siguen preservadas en la base de datos/auditoría y no se mezclan con evidencias vigentes.
- Las pantallas se adaptan a 3 temas y usan componentes compartidos; los permisos siempre se verifican en el backend.
- Las 140 pruebas de FastAPI se ejecutaron en entorno de trabajo y la sintaxis de 32 TS/TSX se verificó. **No se completó `npm run build` en este entorno**, porque npm no pudo descargar paquetes. Debe pasar en VSCode y CI antes de considerar publicado el incremento.

## Seguridad y compatibilidad

- No se modificaron .env, claves, configuración de Supabase, SQL ni el `render.yaml`.
- Backend protege consultas por organización y, en el historial, comprueba oferta y matrícula antes de leer cualquier evidencia.
- La contraseña actual sigue siendo verificada por Supabase Auth; mostrar/ocultar no altera ni introduce políticas de seguridad.
