# EduMaster.ai — CAMBIOS 13, etapa A (v21)

Actualización incremental sobre la versión v20. Incluye catálogo visual con tarjetas, personalización segura del curso base y de cada oferta, y ajustes del sidebar/topbar.

## Alcance

- En el tema **Negro**, sidebar Expandido, Colapsado y Dinámico comparten el mismo fondo `#191919`.
- Hover de **Modo de navegación** en Claro menos saturado (`#edf2f8`).
- Categoría contextual del topbar en **negrita y mayúsculas**, incluida **MI CUENTA**.
- En Cursos, vista **Lista** con tarjetas horizontales y franja de color; vista **Cuadrícula** con ícono y color por curso/oferta.
- Clic en tarjeta: **ficha resumida modal**. Las tareas, materiales y evaluaciones internas se diseñarán en la siguiente etapa; no hay pantallas o datos simulados de esas funciones.
- Administrador institucional / coordinador: modifica el color e ícono **base del curso**.
- Docente **asignado a la oferta**: modifica solo esa oferta y puede restaurar la apariencia base.
- Estudiante: ve la apariencia resultante, sin permisos de modificación.
- Paleta controlada de 10 colores y 12 íconos Lucide; etiquetas ES/EN/PT y auditoría de cambios.

## ¡Importante! Orden de despliegue

Como Render y Vercel publican automáticamente después de un `git push`, **primero** ejecuta la migración en Supabase y **después** publica el código:

1. Haz copia de seguridad de tu proyecto y descomprime el parche en la carpeta que **contiene** `edumaster-ai`, respetando las rutas.
2. En Supabase → **SQL Editor**, ejecuta `database/migrations/006_course_appearance.sql`. No vuelvas a ejecutar las migraciones antiguas. Esta operación agrega columnas con valores predeterminados a cursos y ofertas y valida el catálogo permitido.
3. Confirma que las columnas aparezcan:

   ```sql
   SELECT table_name, column_name
   FROM information_schema.columns
   WHERE table_schema = 'app'
     AND table_name IN ('courses', 'course_offerings')
     AND column_name LIKE 'appearance_%'
   ORDER BY table_name, column_name;
   ```

   Deben aparecer 2 columnas en `courses` y 2 en `course_offerings`. La migración no elimina datos, usuarios, cursos ni matrículas.
4. En Git Bash, desde `edumaster-ai/apps/api`, ejecuta:

   ```bash
   python -m ruff check app tests
   python -m pytest -q
   ```

5. Desde `edumaster-ai/apps/web`, ejecuta:

   ```bash
   npm run build
   npm run dev
   ```

6. Si ambos proyectos pasan, desde **la raíz** de Git:

   ```bash
   cd "$(git rev-parse --show-toplevel)"
   git status
   git add apps/api/app apps/api/tests apps/web/src database/migrations/006_course_appearance.sql LEEME_CAMBIOS13_V21.md
   git diff --cached --stat
   git commit -m "feat(cursos): personalizar tarjetas y ofertas académicas"
   git push origin main
   ```

No se necesitan dependencias npm nuevas ni cambiar los `.env`. Si `git status` muestra archivos confidenciales o ajenos al parche, no hagas el commit hasta revisarlos.

## Pruebas manuales de permisos y persistencia

1. Inicia sesión como administrador institucional o coordinador, selecciona un curso y cambia su ícono y color base. Confirma que otros usuarios de la institución vean la misma tarjeta y que persista al recargar.
2. Desde un docente **asignado a una oferta** de ese curso, cambia su apariencia; comprueba que otras ofertas o períodos conservan la base institucional.
3. Usa **Restaurar apariencia base** en esa oferta y confirma que vuelve a heredar el ícono y color del curso.
4. Inicia sesión como estudiante matriculado. Podrá ver las tarjetas pero no editar su apariencia.
5. Comprueba que un docente sin esa oferta asignada no pueda modificarla. La validación es en FastAPI, no solamente en React.
6. Revisa la alineación, los colores y la navegación en los tres temas, y los textos en español, inglés y portugués.

## API y seguridad

| Método | Ruta relativa de FastAPI | Permiso |
|---|---|---|
| `PATCH` | `/api/v1/academic/organizations/{org}/courses/{course}/appearance` | Gestor institucional activo |
| `PUT` | `/api/v1/academic/organizations/{org}/course-offerings/{offering}/appearance` | Docente activo asignado a la oferta |
| `DELETE` | La misma ruta de la oferta | Docente activo asignado a la oferta |

Las operaciones aceptan exclusivamente los valores de la paleta (no CSS arbitrario), exigen JWT, validan el tenant y registran la acción en `app.audit_logs`. La vista del estudiante usa la identidad autenticada. El esquema `app` mantiene RLS/Force RLS, sin conceder acceso directo a clientes de Supabase.

## Verificación de este paquete

- FastAPI: **163 pruebas correctas** (151 previas + 12 nuevas).
- TypeScript/TSX: **34 archivos revisados con el transpiler de TypeScript** (verificación sintáctica, no equivale a `tsc -b`).
- CSS/PostCSS: analizado sin errores de sintaxis.
- Chromium: mismos fondos del sidebar en Negro y hover más tenue en Claro comprobados en una maqueta CSS.
- **Pendiente de validar en tu máquina:** `npm run build`, `ruff check`, SQL contra Supabase y pruebas de punta a punta después del despliegue. Las dependencias npm no pudieron descargarse en este entorno.

## Próxima etapa

Diseño del **espacio interno de una oferta académica**: contenidos, unidades/lecciones, materiales, actividades y evaluaciones, usando los roles y evidencias ya existentes. No está implementado en este parche.
