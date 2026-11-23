# CAMBIOS 6 — Tema Negro, mapa y código institucional (v9)

## Alcance

- **Tema Negro:** el fondo de todos los modales utiliza negro neutro (`rgb(0 0 0 / 78%)`) en vez de azul pizarra. Se mantiene la preferencia `Desenfoque suave / Sombreado básico` de Configuración.
- **Minimapa:** permite hacer zoom con la rueda del ratón; el desplazamiento del formulario permanece disponible cuando el puntero está fuera del mapa.
- **Tema Negro:** borde del minimapa y divisor de los botones de formulario en escala de grises.
- **Código institucional:** formato único para **nuevas altas**: `<país-ISO-en-minúscula>-<identificador>`. Ejemplos `pe-unmsm`, `co-unal`, `mx-unam`, `es-ucm`. Entre 5 y 40 caracteres, solo ASCII minúscula, dígitos, guion o guion bajo interno; el primer y último carácter del identificador son alfanuméricos. El prefijo debe coincidir con el país seleccionado al crear la institución. Validación tanto en React como en FastAPI.
- **Ayuda:** botón `?` junto a Código institucional con ejemplos internacionales. Placeholder cambia según país seleccionado (`pe-institucion`, `co-institucion`, etc.).
- **Edición:** el código permanece inmutable y su input deshabilitado se atenúa. **No se cambian códigos preexistentes**; editar una institución antigua sigue funcionando.
- **Selector compartido:** `OptionSelect` permite mostrar una abreviatura a la derecha (`suffix`). Países del formulario y del filtro muestran PE, CO, MX, ES, etc.

## Decisión de diseño

El prefijo del código corresponde al país durante el ALTA y es un identificador permanente. Si la sede cambia de país posteriormente por una corrección administrativa, el código histórico no se modifica ni se migra automáticamente para evitar romper referencias. La restricción se aplica en FastAPI al crear, no a la edición ni a las filas existentes de PostgreSQL.

**No se necesita SQL adicional**: el índice único `organizations_code_uniq` ya protege la unicidad global y el CHECK de PostgreSQL admite este formato. Los roles, RLS, credenciales `.env` y datos existentes permanecen intactos.

## Archivos modificados

- `apps/web/src/modules/organizations/OrganizationForm.tsx` — minimapa, código, ayuda, país.
- `apps/web/src/modules/organizations/OrganizationsPage.tsx` — sufijo ISO en filtro.
- `apps/web/src/components/shared/OptionSelect.tsx` — sufijo genérico.
- `apps/web/src/styles.css` — tema Negro, bordes, estado deshabilitado.
- `apps/api/app/routers/organizations.py` — reglas de creación y prefijo.
- `apps/api/tests/test_institution_map.py` — datos actualizados de prueba.
- `apps/api/tests/test_organization_creation_regression.py` — pruebas de formato internacional.

## Aplicación con VSCode y Git Bash

1. Haz una copia de seguridad del código actual (o un commit en Git).
2. Extrae el **parche** encima de la carpeta que contiene `edumaster-ai/`, manteniendo rutas; reemplaza solo los archivos indicados.
3. **No** reemplaces los `.env`. **No** vuelvas a ejecutar `001` ni `002` en SQL Editor.
4. Frontend: `cd apps/web && npm run build && npm run dev`.
5. Backend: desde `apps/api`, activa tu `.venv`; ejecuta `python -m pytest -q` y reinicia `python -m uvicorn app.main:app --reload --port 8000`.
6. Prueba un alta con `pe-unmsm`, prefijo incorrecto `co-lima` con país Perú (debe ser rechazado), edición de una institución existente y selector mostrando siglas.

## Comprobaciones efectuadas en este entorno

- FastAPI pytest: **14 pruebas correctas**.
- AST de archivos TSX/TS: **sin errores de sintaxis**.
- Expresión regular de navegador con flag **v**: casos válidos e inválidos comprobados.
- La compilación npm completa y las pruebas visuales integradas con tu Supabase quedan pendientes en tu VSCode.
