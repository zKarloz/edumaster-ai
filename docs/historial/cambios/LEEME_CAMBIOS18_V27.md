# EduMaster.ai · CAMBIOS 18 · v27

**Base obligatoria:** proyecto v26 instalado y migraciones 001–007 ya aplicadas.

## Contenido de esta entrega

1. Las matrículas duplicadas muestran su mensaje de negocio, sin `(HTTP 409)`.
2. Las pestañas **Inicio** y **Contenido** son anchas y aparecen directamente debajo de la portada del curso; desaparece el botón «Gestionar contenido base».
3. Nuevo componente compartido `Accordion.tsx`: encabezado, flecha animada y acciones alineadas; menú compacto en teléfonos. Respeta `data-motion=off` y `prefers-reduced-motion`.
4. Cursos muestra por defecto **Activo** (`published`) y permite elegir **Borrador** o **Archivado**, sin confundirlo con el estado de la oferta académica.
5. Un gestor puede cambiar el estado del curso desde el menú de su tarjeta. **No** se permite ocultar un curso con matrículas activas; archivar nunca borra historial.
6. Las unidades y lecciones **institucionales** siguen en `app.course_modules` / `app.lessons`. Las de **la oferta** se guardan en `app.offering_modules` / `app.offering_lessons`, con estado, orden y auditoría separados.
7. El docente asignado activo puede gestionar unidades y lecciones **de su oferta** cuando está planificada o abierta, pero no modificar materiales institucionales ni de otra oferta. Los gestores editan ambos niveles. Los estudiantes matriculados solo consultan contenido publicado.
8. Se conserva la prohibición de sobrescribir texto publicado en una única operación; para modificarlo debe pasarse primero a borrador. El versionado formal del editor sigue pendiente de la siguiente etapa.

**Alcance:** tareas, entregas de archivos, evaluaciones y notas vinculadas a lecciones aún no se crean en esta actualización.

## Instalación obligatoria (en este orden)

### 1. Supabase: migración 008 antes de publicar

Abrir **Supabase > SQL Editor** y ejecutar por completo:

`database/migrations/008_offering_content.sql`

Verificar:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema='app'
  AND table_name IN ('offering_modules','offering_lessons')
ORDER BY table_name;
```

Deben aparecer las **dos tablas**. Verificar RLS:

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid IN ('app.offering_modules'::regclass,'app.offering_lessons'::regclass);
```

Los valores `relrowsecurity` y `relforcerowsecurity` deben ser `true`.

**No repetir la migración 007.** No modifica `.env` ni crea cuentas nuevas.

### 2. Aplicar el parche

Extraer el ZIP incremental sobre la carpeta `edumaster-ai` conservando rutas.
Alternativamente, conservar el ZIP completo como respaldo.

### 3. Verificar backend (VSCode, Git Bash)

Desde la raíz del repositorio:

```bash
cd apps/api
python -m ruff check app tests
python -m pytest -q
```

Se esperan **203 pruebas** en esta entrega. La comprobación Ruff debe hacerse en tu VSCode; no estuvo disponible durante la preparación.

### 4. Verificar frontend

```bash
cd ../web
npm run build
npm run dev
```

La compilación completa de Vite debe confirmarse en tu VSCode. Esta entrega no añade dependencias npm.

### 5. Publicar una vez validados SQL, Ruff, pruebas y build

```bash
cd "$(git rev-parse --show-toplevel)"
git add apps/api/app apps/api/tests apps/web/src database/migrations/008_offering_content.sql LEEME_CAMBIOS18_V27.md
git commit -m "feat(cursos): habilitar contenido por oferta y mejorar navegación académica"
git push origin main
```

## Prueba de aceptación recomendada

1. Abrir Cursos como gestor; verificar filtro **Activo** por defecto y filtros Borrador/Archivado.
2. En una oferta con docente asignado, entrar en **Contenido**, crear una **unidad institucional** y una **unidad de la oferta**.
3. Con el docente asignado: editar/publicar solo la unidad de su oferta, crear una lección y comprobar que la unidad institucional no tiene controles de edición.
4. Con un segundo docente de otra oferta del mismo curso: confirmar que no puede modificar ni ver borradores de la primera oferta; sí puede gestionar su propia oferta.
5. Como estudiante matriculado: acceder a contenido publicado (institucional y de la oferta) y confirmar que borradores/archivados no aparecen.
6. Intentar modificar una unidad publicada: debe solicitar volver primero a borrador.
7. En Matrículas: repetir una matrícula y comprobar que el aviso dice solo «El estudiante ya está matriculado en esta oferta».
8. En curso con matrículas activas: intentar archivar. Debe bloquearse sin perder datos.
9. En curso sin matrículas activas: archivarlo, buscarlo mediante filtro Archivado y restaurarlo mediante las acciones de la tarjeta.
10. Comprobar en escritorio y teléfono el encabezado de la unidad, la flecha animada y el menú compacto.

## Verificación disponible en la entrega

- **203/203 pruebas de FastAPI correctas** con conexiones simuladas.
- **38 archivos TypeScript/TSX** sin errores de análisis sintáctico.
- Migración SQL 008 creada, sin ejecutar todavía contra tu Supabase.
- **Pendiente en VSCode:** Ruff y `npm run build`.
- **Pendiente en Supabase real:** ejecutar SQL y ensayar permisos/RLS, publicación y ordenamiento con usuarios reales.
