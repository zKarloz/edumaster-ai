# CAMBIOS 20 · v29.1 — Entrega integrada

**Base:** commit `3895ed3` (v28). **Alcance:** editor Tiptap, borradores independientes, validación y rutas académicas compatibles.

## Regla académica

Una lección publicada mantiene la revisión visible mientras se crea y edita otro borrador; guardar borrador jamás altera la proyección `app.lessons` o `app.offering_lessons` publicada.

## Contenido de v29.1

- Editor enriquecido OSS, vista previa, guardado manual, bloqueos de navegación y avisos de conflicto.
- Rutas `GET/POST/PATCH` de borrador para lecciones institucionales y lecciones de oferta.
- Migración `009_lesson_revisions.sql` para revisiones iniciales y restricción de borrador único y publicación única.
- Compatibilidad transaccional de las rutas heredadas; la publicación de nuevos documentos Tiptap **no está habilitada** en esta entrega.
- RLS activada y forzada; la autorización de tenant y rol se verifica en FastAPI (la cuenta del servidor utiliza `BYPASSRLS`).

## Estado de verificación

- **261** pruebas del backend (pytest) superadas en el entorno de preparación.
- **14** pruebas del editor y compilación TypeScript/Vite superadas en Windows, según resultado aportado por el usuario con el hotfix TS.
- Migración 009 **no ejecutada en PostgreSQL** en el entorno de preparación: ejecutar solo tras respaldo.
- No se incluyó un `package-lock.json` inventado: el instalador genera el real mediante `npm install`; versionarlo junto con el proyecto.
- El empaquetado incremental debe verificar hashes antes de sobrescribir.

## Orden de actualización

1. Respaldar Supabase y conservar `git status` limpio en el proyecto v28.
2. Ejecutar `bash ../PAQUETE_CAMBIOS20_V29_1/aplicar_v29_1.sh . --check` desde la raíz de `edumaster-ai`.
3. Poner el editor académico en mantenimiento y aplicar **una vez** `database/migrations/009_lesson_revisions.sql` mediante Supabase SQL Editor, usando el archivo del paquete bajo `archivos/database/migrations/`.
4. Validar con `tools/verificacion/postflight_009_resumen.sql` en SQL Editor (también disponible dentro del paquete).
5. Ejecutar `bash ../PAQUETE_CAMBIOS20_V29_1/aplicar_v29_1.sh . --apply`.
6. Terminal API: `python -m ruff check app tests && python -m pytest -q` y verificación de permisos `python ../../tools/verificacion/verificar_009_api.py`.
7. Terminal web: `npm install --no-audit --no-fund && npm run build && npm run test:editor`; guardar `package-lock.json` en Git.
8. Comprobar inicio de sesión como gestor, docente y estudiante, y confirmar que la versión pública no cambia al guardar borrador.
9. Revisar `git diff --check`, `git status`, registrar cambios y desplegar cuando todo funcione.

**Si la migración falla:** el bloque SQL usa `BEGIN/COMMIT`; inspeccionar el error y no desplegar el backend nuevo hasta resolverlo. Si falla el instalador, este no debe alterar el código cuando hay diferencias de base. No revertir la migración borrando la tabla: consultar antes el respaldo.

## Limitaciones intencionales

- Los archivos privados quedan para v29.2.
- La publicación de revisiones Tiptap y el historial/recuperación avanzados quedan para v29.3.
- La edición heredada de lecciones publicadas devuelve un conflicto controlado y ofrece crear un borrador.
