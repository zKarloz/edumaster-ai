> **Actualización v13:** usuarios institucionales (roles locales, perfiles académicos, suspensión/reactivación). Consulta [`LEEME_INCREMENTO_USUARIOS_V13.md`](LEEME_INCREMENTO_USUARIOS_V13.md).

> **Incremento v12:** Módulo Usuarios para asignar/revocar administradores institucionales. Consulta [LEEME_INCREMENTO_USUARIOS_V12.md](LEEME_INCREMENTO_USUARIOS_V12.md).

# EduMaster.ai — Starter VSCode / Git Bash

**Plataforma multiinstitución · implementación incremental**

Este repositorio reúne un **frontend React con login obligatorio por Supabase Auth**,
una API FastAPI con permisos y un mapa interactivo de instituciones internacionales
con datos almacenados en PostgreSQL. Incluye SQL para crear la base y la migración
de ubicaciones. Es una base de desarrollo, **no una aplicación Enterprise terminada
ni un servicio preparado para manejar datos personales reales**.

## Códigos institucionales (desde CAMBIOS 6 / v9)

Las **altas nuevas** usan identificadores únicos con prefijo ISO del país:
`pe-unmsm`, `co-unal`, `mx-unam`, `es-ucm`. El código se fija al crear la
institución; los existentes no se alteran y en edición se muestra deshabilitado.
La ubicación del país puede corregirse después sin cambiar ese identificador
histórico. Consultar `docs/CAMBIOS6_TEMAS_MAPA_CODIGOS.md`.

## Tecnologías

- React 19 + TypeScript estricto + Vite + Tailwind CSS v4 + lucide-react.
- Componentes compartidos: `DataTable` paginada, `Modal`, `ModalBackdrop`, `OptionSelect`, `Spinner`, `Toast`.
- Temas claro/oscuro/negro, preferencias locales y diseño responsive basado en los colores del documento maestro.
- FastAPI + SQLAlchemy async + PostgreSQL/Supabase + Auth JWT vía JWKS.
- Monorepo + Git Bash + GitHub Actions + `render.yaml` + `vercel.json`.

## 1. Preparar el entorno en Windows

Instalar: **Git**, **VSCode**, **Node.js 22 LTS** y **Python 3.12**.
Desde **Git Bash**, descomprimir el proyecto y abrir la carpeta raíz:

```bash
cd /c/ruta/donde/descomprimiste/edumaster-ai
code .
```

## 2. Iniciar frontend (terminal 1)

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

Abrir **http://localhost:5173**. Se muestra el login de Supabase Auth. Tras
validar el JWT y el perfil de usuario en FastAPI, aparecen los módulos, el mapa
institucional y las preferencias de interfaz (temas Claro, Oscuro y Negro).

## 3. Iniciar backend (terminal 2 en Git Bash)

Desde la **raíz del repositorio**:

```bash
cd apps/api
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

Antes de crear el entorno, confirma la instalación: `python --version` y
`python -c "import sys; print(sys.executable)"`. Si Git Bash activa Anaconda en
lugar de Python estándar, selecciona un intérprete compatible en VSCode. Para macOS/Linux, activa con `source .venv/bin/activate`.

Comprobar **http://localhost:8000/health** y la documentación
**http://localhost:8000/docs**. En Git Bash puedes ejecutar:

```bash
curl http://localhost:8000/health
pytest -q
ruff check app tests
```

El frontend comprobará el backend automáticamente. Para acceder a los módulos es
necesario configurar Supabase Auth y disponer de una cuenta habilitada en `app.users`.

## 4. Conectar Supabase Free

1. Crear un proyecto de desarrollo en [Supabase](https://supabase.com/).
2. Ejecutar `database/migrations/001_initial_schema.sql` en el SQL Editor.
3. Crear una cuenta en **Authentication** y vincularla mediante el ejemplo
   administrativo descrito en `database/README.md`.
4. Habilitar un **JWT Signing Key asimétrico** en Supabase Auth; la API acepta
   ES256/RS256 (no HS256 legado). Consultar el estado en el panel de Supabase.
5. En `apps/web/.env`, configurar variables públicas:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://TU-REFERENCIA.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

6. En `apps/api/.env`, configurar **solo variables del servidor**:

```dotenv
SUPABASE_URL=https://TU-REFERENCIA.supabase.co
# Ejemplo ilustrativo: copiar el valor real en Supabase > Connect > Session pooler.
# Sustituir postgresql:// por postgresql+asyncpg:// en la URL copiada.
DATABASE_URL=postgresql+asyncpg://USUARIO:CONTRASENA@POOLER-HOST:5432/postgres
ALLOWED_ORIGINS=http://localhost:5173
```

Si tu contraseña tiene símbolos `@`, `:` o `/`, usa codificación URL apropiada
para evitar errores en la conexión. Nunca subir archivos `.env` al repositorio.
No añadir `app` a la lista de esquemas expuestos por Supabase Data API.

## 5. Preparar Git (sin publicar secretos)

```bash
git init
git add .
git commit -m "chore: base multiinstitucion EduMaster Sprint 1"
git branch -M main
```

Crear un repositorio **privado** y vacío desde la interfaz de GitHub; después copiar su URL:

```bash
git remote add origin https://github.com/TU_USUARIO/edumaster-ai.git
git push -u origin main
```

## 6. Desplegar: Vercel + Render + Supabase

**Render (API)**: repo GitHub → New Web Service → seleccionar plan Free,
`Root Directory = apps/api`, `Build Command = pip install -r requirements.txt`,
`Start Command = uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
Configurar `DATABASE_URL`, `SUPABASE_URL`, `ALLOWED_ORIGINS`. El archivo
`render.yaml` permite definir un blueprint equivalente.

**Vercel (frontend)**: importar repo → `Root Directory = apps/web`, Framework
Vite, Build `npm run build`, Output `dist`. Agregar las 3 variables `VITE_*`;
`VITE_API_URL` debe apuntar a `https://TU-API.onrender.com`. En Render, configurar
`ALLOWED_ORIGINS` con la URL HTTPS exacta de Vercel, sin barra final.

**Supabase (PostgreSQL/Auth)**: usar el mismo proyecto durante las pruebas;
configurar URLs permitidas en Auth según el dominio final. Guardar acceso de
administración únicamente en el backend/secret manager.

**Advertencias de planes Free:** Render puede suspenderse por inactividad;
Supabase puede pausar proyectos inactivos; Vercel Hobby restringe uso comercial.
No tomar estas opciones como SLA de producción Enterprise. Los PDFs originales no
se incluyen en el ZIP para evitar publicarlos por accidente; se conservan en
las fuentes del proyecto EduMaster.

## Próximos hitos (Scrum)

- Sprint 1: alta segura de usuarios, roles RBAC, ABAC, CRUD institucional y
  pruebas negativas A/B (sin acceso transversal).
- Sprint 2–3: cursos, matrículas, lecciones, evaluaciones y tracking transaccional.
- Sprint 4+: dashboard de KPIs verificables, tiempo real, DataOps, ML y MLOps.

## Fuentes base

- `Documentacion_EduMaster_AI_Enterprise.pdf`, §3, §6–7, §10–11 y §15.
- `EduMaster_AI_Manual_Funcionamiento_Procedimientos_Enterprise.pdf`, §3,
  §6–7, §12–14.
- Diseño Sprint 0: `docs/DECISIONES_SPRINT0.md` y `docs/sprint0/`.

## Actualización TAREA-11: interfaz y preferencias

Se ha incorporado la pestaña **Configuración**, los temas Claro/Oscuro/Negro,
cuatro posiciones de notificación flotante, sidebar desplegable y animaciones
suaves. Los datos de preferencia se guardan en este navegador, por ámbito de
invitado o usuario autenticado; aún no se sincronizan con Supabase.

Consulta `docs/TAREA-11-CAMBIOS_IMPLEMENTADOS.md` para revisar los diez cambios,
las pruebas manuales y las limitaciones de esta iteración.

## Sprint 1 — Login obligatorio y superadministrador

La interfaz exige una sesión de Supabase Auth **y** una cuenta autorizada en
EduMaster.ai antes de mostrar los módulos. Para crear el primer superadministrador,
consulta `docs/AUTENTICACION_Y_SUPERADMIN_SPRINT1.md` y ejecuta manualmente
`database/admin/002_bootstrap_superadmin.sql` tras sustituir el correo.
La API expone `GET /api/v1/me` (401 por JWT, 403 por perfil no habilitado).

## Sprint demo: mapa internacional de instituciones (v5)

**Importante:** si la base ya tiene las 29 tablas iniciales, ejecutar **solo**
`database/migrations/002_institution_locations.sql` (crea una tabla adicional,
no reinicializa nada). En `apps/web` ejecutar `npm install` para instalar Leaflet
/ React Leaflet, `npm run build` y `npm run dev`. En `apps/api`, actualizar
requisitos (`tzdata`), arrancar Uvicorn y entrar como superadmin.

La interfaz tiene catálogo izquierdo, filtros por país, mapa con marcadores,
formulario de alta/edición y diseño ampliado a 1440 px. Para detalles de
seguridad, límites y pruebas ver `docs/MAPA_INSTITUCIONES_SPRINT1.md`.


## CAMBIOS 7 (v10): ayuda contextual y preferencias de movimiento

- En **Instituciones**, el botón `?` del código institucional abre una ayuda flotante
  con ejemplos (sin empujar los campos). Se cierra suavemente con el botón,
  Escape o clic fuera. Implementación reutilizable: `HelpPopover.tsx`.
- Etiquetas y campos del formulario institucional: separación uniforme de 6 px.
- Los modales aparecen con el mismo levantamiento sutil que el contenido de módulos.
- **Configuración → Animaciones de la interfaz** permite habilitar o deshabilitar
  el movimiento global. Se respeta además `prefers-reduced-motion` del sistema.
- Las preferencias siguen en `localStorage` por usuario, sin cambios en Supabase.

Para actualizar desde v9, copiar únicamente los archivos del parche v10; no ejecutar
 SQL ni reemplazar `.env`. Ver `docs/CAMBIOS7_POPUP_ETIQUETAS_ANIMACIONES.md`.


## Incremento académico (v11)

Los módulos **Cursos**, **Estudiantes** y **Matrículas** utilizan las tablas académicas ya presentes en `app`. Para permisos, flujo de registro, pruebas y límites, consulta [`docs/INCREMENTO_ACADEMICO_V11.md`](docs/INCREMENTO_ACADEMICO_V11.md). No se requiere una nueva migración SQL.
