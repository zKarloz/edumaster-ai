# EduMaster.ai

Plataforma web multiinstitución de gestión académica y aprendizaje inteligente.

**Estado:** desarrollo incremental, rama de trabajo **v27.1** (cierre de CAMBIOS 18).
No se presenta como una solución Enterprise finalizada. Las funcionalidades de IA,
evaluaciones y analítica avanzada se implementarán en etapas posteriores.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, lucide-react, i18next.
- **Backend:** Python 3.12+, FastAPI, Pydantic, SQLAlchemy asíncrono.
- **Datos y autenticación:** PostgreSQL + Supabase Auth; autorización en FastAPI por rol e institución.
- **Entrega:** VSCode, Git Bash, GitHub Actions, Vercel y Render (según las condiciones de sus planes).
- **UI compartida:** tablas paginadas, modales, panel inferior móvil, selectores, spinner,
  notificaciones flotantes, acordeón y menú contextual. Temas Claro/Oscuro/Negro.

## Requisitos

Windows con VSCode + Git Bash, Git, Node.js 22 LTS y Python 3.12+.
Crear las variables de entorno locales a partir de los ejemplos; nunca subir credenciales.

## Configurar por primera vez

**Backend** (`apps/api/.env` a partir de `apps/api/.env.example`):

```bash
cd apps/api
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env  # solo si todavía no existe
```

**Frontend** (`apps/web/.env` a partir de `apps/web/.env.example`):

```bash
cd apps/web
npm install
cp .env.example .env  # solo si todavía no existe
```

Configurar las claves y direcciones de Supabase según ambos archivos `.env.example`.
**Nunca reemplazar un `.env` ya configurado ni subirlo a Git.**

## Iniciar en VSCode (3 terminales Git Bash)

Abrir cada terminal en la raíz `edumaster-ai`:

**Terminal 1 — Backend**

```bash
cd apps/api
source .venv/Scripts/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**

```bash
cd apps/web
npm run dev
```

**Terminal 3 — Git y verificaciones**

```bash
git status --short
# Comprobaciones Python: desde apps/api, con .venv activado.
cd apps/api
python -m ruff check app tests
python -m pytest -q
# Comprobación React: desde apps/web.
cd ../web
npm run build
```

Interfaz: <http://localhost:5173/> · salud API: <http://localhost:8000/health>.
Los módulos privados requieren credenciales Supabase y un perfil habilitado en la API.

## Base de datos

Esquema académico `app` en Supabase. Las migraciones versionadas se encuentran en
[`database/migrations/`](database/migrations/) y el procedimiento original en
[`database/README.md`](database/README.md). **No volver a ejecutar migraciones antiguas
sobre una base ya configurada**. La entrega v27.1 no contiene nuevas migraciones.

## Documentación y estado de la versión

- [Índice de documentación](docs/README.md).
- [CAMBIOS 18 — cierre v27.1 y checklist](docs/historial/cambios/CAMBIOS18_CIERRE_V27_1.md).
- [Estructura del curso v26](docs/historial/incrementos/LEEME_ESPACIO_ACADEMICO_V26.md).
- [Cambios 18, v27](docs/historial/cambios/LEEME_CAMBIOS18_V27.md).

Las notas antiguas se mantienen en `docs/historial/` como referencia, y los dos PDFs
Enterprise permanecen como fuentes externas sin publicarse dentro del repositorio.

## Despliegue

Frontend en Vercel (raíz `apps/web`) y API en Render (raíz `apps/api`), con variables
configuradas en cada proveedor. Revisar límites, políticas y costes de los planes
antes de usar el sistema con usuarios reales. Las comprobaciones de permisos y
seguridad deben validarse contra Supabase de pruebas antes de desplegar a producción.

## Laboratorio ML DEMO (v31.1)

Para generar datos académicos ficticios, validar su integridad y entrenar el primer
modelo de referencia, consulta [tools/ml_demo/README.md](tools/ml_demo/README.md).
**No accede a datos reales, no crea usuarios y no ejecuta migraciones SQL.**
