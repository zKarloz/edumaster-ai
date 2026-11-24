# CAMBIOS 20 · v29.1 — Revisión F: plan de validación aislada

> **NO INSTALAR. NO EJECUTAR LA MIGRACIÓN 009 EN PRODUCCIÓN.**
>
> La versión de trabajo estable continúa siendo v28. El ZIP `RevisionF` es una copia de ensayo con las revisiones desarrolladas hasta E y las herramientas de verificación agregadas en F.

## Estado verificable

- Backend y frontend de la revisión E conservados (endpoints de borradores, editor Tiptap, guardado, control de concurrencia y protección de navegación).
- Pruebas unitarias de Python y Node ejecutables sin PostgreSQL, pero **no sustituyen pruebas de integración reales**.
- Sin servidor PostgreSQL en el entorno de preparación, la migración 009 **no se ha ejecutado**.
- Sin acceso a `registry.npmjs.org` en el entorno de preparación, **no se ha ejecutado `npm install` ni el build completo con dependencias Tiptap**.
- La librería Tiptap y React Router deberán instalarse y verificarse en VSCode antes de declarar esta entrega lista.

## 1. Comprobar el frontend SIN sustituir la v28

Con la terminal de Git Bash del proyecto estable abierta en su raíz, ejecuta el validador desde una carpeta de ensayo donde hayas descomprimido el ZIP de Revisión F, o copia solamente el archivo `validar_frontend_en_copia.py` a una carpeta externa. Necesita **el ZIP completo de Revisión F**, no el incremental.

```bash
python tools/verificacion/validar_frontend_en_copia.py "/ruta/al/EduMaster_CAMBIOS20_v29_1_RevisionF_ProyectoCompleto_NO_INSTALAR.zip"
```

El script crea una carpeta temporal fuera del proyecto activo; instala las dependencias (`npm install`), ejecuta `npm run build` y `npm run test:editor`. **Nunca copia los archivos del ensayo a v28.** Indica la ruta generada para consultar el resultado o el `package-lock.json`.

> El instalador final deberá incorporar un `package-lock.json` revisado y fijado. En esta fase no se versiona uno no resuelto.

## 2. Prueba real de migración 009 en PostgreSQL DESECHABLE

Para probar estructura y SQL sin tocar Supabase, se entrega:

- `tools/verificacion/fixture_009.sql` — crea datos falsos en un esquema `app` nuevo.
- `tools/verificacion/aserciones_009.sql` — verifica conservación de texto, NULL, estados, aislamiento, claves foráneas, borrador único y RLS.
- `tools/verificacion/probar_009_local.sh` — requiere `psql` y un entorno PostgreSQL de ensayo sin esquema `app`.

Ejemplo, **solo si dispones de PostgreSQL de prueba** y has creado una base `edumaster_v29_ensayo` totalmente independiente:

```bash
export EDUMASTER_TEST_DB_URL="postgresql://postgres@localhost:5432/edumaster_v29_ensayo"
export EDUMASTER_SQL_TEST_CONFIRM=ONLY_DISPOSABLE_DB
bash tools/verificacion/probar_009_local.sh
```

El script comprueba que la base NO contenga un esquema `app` antes de ejecutar ningún archivo. No reconoce una URL de producción ni la solicita. **No ejecutes esta prueba sobre un proyecto Supabase con datos reales.**

## 3. Inspección previa de Supabase (solo lectura)

El archivo `tools/verificacion/preflight_009_solo_lectura.sql` puede ejecutarse en SQL Editor de Supabase. Lee los recuentos por estado, PostgreSQL, las políticas RLS de las tablas heredadas y confirma que `app.lesson_revisions` aún no exista. No ejecuta DDL ni escribe datos.

El resultado de `rolbypassrls=True` obtenido en la terminal API confirma que el rol de FastAPI omite RLS, pero **no acredita privilegios de tabla** después de la migración. Éstos se validarán mediante `has_table_privilege` en ensayo, con el mismo usuario efectivo que utiliza FastAPI.

## 4. Criterios para autorizar instalación

- `npm run build` y `npm run test:editor` superados con dependencias instaladas y lockfile reproducible.
- `ruff check app tests` y `pytest -q` superados.
- SQL 009 probada en PostgreSQL aislado; constraints, privilegios y persistencia verificadas.
- Prueba manual del editor real en navegador con docente, coordinador y estudiante; confirmación de que los borradores NO alteran lo publicado.
- Plan de despliegue coordinado: respaldo de Supabase, migración 009, backend, frontend, verificación y estrategia de recuperación.

No publicar ni aplicar la revisión F al repositorio estable antes de completar estas pruebas.
