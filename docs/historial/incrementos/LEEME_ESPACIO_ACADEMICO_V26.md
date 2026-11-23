# EduMaster.ai — Espacio académico y unidades v26

Esta entrega continúa **v25 (CAMBIOS 17)**. Introduce la primera versión funcional del interior de los cursos **sin crear tareas ni evaluaciones**. Mantiene arquitectura React + TypeScript + Tailwind / FastAPI / Supabase PostgreSQL (esquema `app`).

## 1. Antes de desplegar — migración SQL 007 obligatoria

1. Abre Supabase > SQL Editor con permisos administrativos.
2. Ejecuta el contenido de `database/migrations/007_course_content.sql` **una vez**.
3. Comprueba:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name IN ('course_modules', 'lessons')
  AND column_name IN ('description','created_at','updated_at')
ORDER BY table_name, column_name;
```

Esperado: `course_modules` añade `description`, `created_at`, `updated_at` y `lessons` añade `created_at`, `updated_at` (cinco filas). Los estados ahora admiten `draft`, `published`, `archived`. No se crean políticas de RLS de acceso directo; se conserva RLS forzado.

**No hagas `git push` antes de ejecutar la migración.** Sin ella, FastAPI puede devolver errores SQL 503 al consultar unidades.

## 2. Aplicar el parche

Descomprime el ZIP **dentro de la carpeta que contiene `edumaster-ai`**, fusionando los archivos por sus rutas. No copies un `edumaster-ai` anidado dentro de otro. El paquete no contiene `.env` ni credenciales.

### Verificaciones locales desde la raíz del repositorio, Git Bash en VSCode

```bash
cd apps/api
python -m ruff check app tests
python -m pytest -q
# En otra terminal, desde apps/api:
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd apps/web
npm run build
npm run dev
```

La comprobación local del autor encontró **180/180 pruebas FastAPI correctas** y 36 archivos TS/TSX analizados sin errores de sintaxis. La compilación completa con dependencias npm y Ruff no estuvieron disponibles en el entorno de generación: confirma ambas localmente.

### GitHub y despliegue automático (solo después de las comprobaciones)

```bash
cd "$(git rev-parse --show-toplevel)"
git status
git add apps/api/app/main.py apps/api/app/routers/course_content.py apps/api/tests/test_course_content_v26.py

git add apps/web/src/App.tsx apps/web/src/routes.ts apps/web/src/i18n.ts apps/web/src/styles.css

git add apps/web/src/modules/academic/CourseCatalog.tsx apps/web/src/modules/academic/CourseWorkspacePage.tsx

git add database/migrations/007_course_content.sql LEEME_ESPACIO_ACADEMICO_V26.md

git commit -m "feat(cursos): crear espacio académico y gestión segura de unidades"
git push origin main
```

## 3. Funciones reales

- El clic en una tarjeta de Cursos abre el espacio académico, no la antigua ficha modal. La apariencia sigue disponible mediante el botón con paleta; la selección de color/ícono continúa persistida en el backend.
- Ruta por oferta: `/academico/organizaciones/{organizationId}/ofertas/{offeringId}`.
- Ruta de edición del curso base: `/academico/organizaciones/{organizationId}/cursos/{courseId}`.
- **Inicio:** datos del curso y conteos calculados de unidades/lecciones; tareas y evaluaciones aparecen como trabajo futuro, no como resultados reales.
- **Contenido:** unidades desplegables con lecciones; creación, edición, subida/bajada de orden y publicación para gestores institucionales.
- Al crear se guarda **borrador**. Para que el estudiante vea la lección, **unidad y lección** deben estar publicadas, y debe tener matrícula activa o completada en una oferta autorizada.
- Docente **asignado y activo**: consulta su oferta y previsualiza contenido; no modifica el curso base compartido sin autorización de edición institucional específica (que aún no existe). Un estudiante sin matrícula no puede acceder mediante URL.
- Curso base reutilizable entre períodos; **no crea actividades ni fechas globales**. Estas pertenecerán a las ofertas en incrementos futuros.
- Todo el texto se presenta como texto plano (React escapa HTML); editor enriquecido, archivos privados y versiones quedan para v27.
- Para modificar títulos o textos ya publicados se exige antes cambiar el estado a borrador. Esta protección provisional evita una sobrescritura invisible para estudiantes. No hay historial de revisiones todavía.
- Cada escritura y reordenamiento relevante se audita en `app.audit_logs` con la transacción de datos.

## 4. Prueba funcional sugerida

1. Como **administrador institucional/coordinador**, entra a Cursos > elige una oferta > «Gestionar contenido base».
2. En **Contenido**, crea «Unidad 1» (borrador) y, al desplegarla, «Lección 1» (borrador).
3. Edita ambas por separado para marcar **Publicado**. Puedes cambiar orden con las flechas.
4. Inicia sesión como **docente asignado**: abre su oferta y comprueba la lectura del contenido (incluidos borradores de preparación).
5. Inicia sesión como **estudiante matriculado** en esa oferta: solo debe ver la unidad/lección publicadas.
6. Regresa como gestor, archiva una lección y verifica que desaparezca de la vista estudiantil.
7. Prueba un usuario ajeno a la oferta: debe obtener **403/404**, sin contenido de otras instituciones.
8. Repite en temas Claro, Oscuro y Negro; en teléfono comprueba el diseño adaptable.

## 5. Siguientes incrementos, todavía no implementados

- **v27:** editor enriquecido, recursos/archivos privados, control de versiones y publicación controlada.
- **v28:** tareas por oferta, entregas y revisión.
- **v29:** evaluaciones, intentos, rúbricas y calificaciones oficiales vinculadas a matrícula y oferta.

Ninguna predicción de IA modifica automáticamente contenido ni notas oficiales.
