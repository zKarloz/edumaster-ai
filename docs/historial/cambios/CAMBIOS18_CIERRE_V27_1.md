# EduMaster.ai — cierre CAMBIOS 18 · entrega v27.1

**Base:** proyecto completo v27 recibido el 23-11-2026.  
**Alcance:** cambios de interfaz, correcciones de Ruff y reorganización documental.  
**Base de datos:** ninguna tabla, migración SQL ni política RLS modificada.

## Mejoras implementadas

1. **Menú contextual reutilizable** (`ResponsiveActionMenu.tsx`): botón de tres puntos en ambas vistas de Cursos. En pantallas grandes aparece un menú flotante anclado al control, fuera de la tarjeta para evitar recortes. En teléfonos usa el `BottomSheet` compartido de Perfil con cierre por gesto. Pulsar fuera o Escape cierra el menú de escritorio.
2. **Acciones separadas:** `Editar tema` abre exclusivamente la personalización; `Cambiar estado` abre exclusivamente el selector de estado. La acción de estado se muestra solo a gestores institucionales, de acuerdo con los permisos existentes. En cursos archivados no se permite editar la apariencia, pero el gestor puede reactivar o cambiar su estado.
3. **Filtros de unidades:** `Vigentes (publicadas y borradores)`, `Publicadas`, `Borradores`, `Archivadas` y `Todas`. Por defecto se ocultan las unidades archivadas. El estudiante mantiene únicamente contenido publicado, filtrado además en el backend.
4. **Acordeón:** corrección de la animación del chevron compartido mediante `transform: rotate(...)` con transición CSS y respeto a movimiento reducido / preferencia de animaciones desactivadas.
5. **Limpieza de interfaz:** se elimina el texto técnico sobre FastAPI del listado de Cursos (y sus traducciones) sin modificar la autorización de backend.
6. **Calidad Python:** orden de importaciones de `main.py` y simplificación de la condición anidada en `test_cambios18_v27.py`, sin cambiar sus resultados.
7. **Documentación:** raíz con `README.md` general; archivos históricos agrupados en `docs/historial/`, documentos de arquitectura en `docs/arquitectura/`, índice `docs/README.md`. Archivos `.diff` antiguos quedan únicamente como referencia.
8. **Git:** se añade `*.tsbuildinfo` a `.gitignore`; un archivo ya rastreado requiere retirar su seguimiento por separado, sin borrar la copia local.

## Comprobaciones realizadas durante la preparación

- **Backend:** `python -m pytest -q` → **203 pruebas aprobadas** sobre la copia v27.1.
- **Frontend:** los cinco archivos TypeScript/TSX modificados pasan el análisis sintáctico de TypeScript. **No se pudo completar `npm install` ni ejecutar el build Vite en el entorno de preparación**; validar con el `node_modules` de VSCode antes de commit/despliegue.
- **Supabase:** el usuario confirmó RLS activada y forzada para `courses`, `course_offerings`, `course_modules`, `lessons`, `offering_modules` y `offering_lessons`. Esto no valida individualmente las políticas RLS ni las pruebas de autorización entre docentes.
- **Ruff:** las dos incidencias informadas (`I001` y `SIM102`) fueron corregidas; ejecutar Ruff localmente para certificarlo.

## Pruebas manuales recomendadas en VSCode

- Abrir Cursos como gestor y comprobar ambos tipos de tarjeta, menú de tres puntos, selección de `Editar tema` y selección de `Cambiar estado`.
- Archivar un curso **sin matrículas activas** y verificar que desaparece del filtro inicial `Activo`; seleccionando `Archivado` debe volver a aparecer. Restaurarlo y verificar el comportamiento inverso.
- Abrir Curso → Contenido. Confirmar que `Vigentes` oculta archivadas, `Archivadas` permite localizarlas y `Todas` muestra el conjunto completo. Probar la flecha del acordeón con animaciones activas, desactivadas y `prefers-reduced-motion`.
- Comprobar menú de cursos y acciones de unidades en teléfono (panel inferior), y en temas Claro, Oscuro y Negro.
- Como docente asignado, verificar que puede gestionar contenido de su oferta, no el institucional ni una oferta ajena. Como estudiante, confirmar que no accede a borradores ni archivados, incluso a través de la API.
- Probar un segundo docente sobre la misma oferta y aclarar la política de colaboración antes de cambiar esquema o permisos.
- Ejecutar `python -m ruff check app tests`, `python -m pytest -q`, `npm run build` y `git diff --check` antes del commit.

## Aspectos deliberadamente no incluidos

- No se altera el modelo de un único `instructor_id` por oferta ni se agregan permisos por autor de unidad.
- No se añade contenido enriquecido, subida privada de archivos, versionado editorial, tareas o evaluaciones: deben planificarse en incrementos posteriores y comprobarse contra los dos documentos Enterprise.
- No se automatiza un commit, `git push`, el despliegue ni migraciones SQL.

## Aplicación de la entrega incremental

La variante **solo cambios** incorpora un parche de código (`codigo_v27_1.patch`) y un instalador en Git Bash que **comprueba primero la compatibilidad con la base v27**, hace respaldo de documentación local y no modifica datos de Supabase. Consultar `LEEME_INSTALACION.md` en el paquete incremental.

Si `git apply --check` falla, **no fuerces la aplicación**: significa que algún archivo local no coincide con la base del ZIP, y conviene comparar el archivo local antes de integrarlo. La variante completa sirve como referencia y copia para nuevos entornos; no debe sobrescribir una instalación que ya tenga cambios propios.
