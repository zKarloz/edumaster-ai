# EduMaster.ai | Sprint 1 — Directorio geográfico multiinstitución

Estado: prototipo integrado en código; requiere migración `002`, instalación local de dependencias y verificación manual con Supabase.

## Decisiones aprobadas

- **Opción A:** catálogo/filtros en panel lateral izquierdo y mapa interactivo grande a la derecha; en móvil se apilan verticalmente.
- **Opción 2:** ampliar `main` de `max-w-7xl` (1280 px) a `max-w-[1440px]` en la v5; ampliado a `max-w-[1680px]` con márgenes adaptables en la v6 (ver `CAMBIOS4_MODAL_MAPA_Y_ANCHO.md`).
- **Internacional:** país (código ISO de dos letras), ciudad, dirección opcional, coordenadas, zona horaria IANA.
- **Seguridad:** solo `superadmin` activo crea/edita; lectura limitada a instituciones autorizadas por FastAPI.

## Instalación local desde el proyecto ACTUAL

1. Guarda una copia de tu proyecto, en especial tus `.env` locales (el ZIP no incluye secretos).
2. Aplica **solo** el parche en la raíz del proyecto respetando rutas.
3. En Supabase **SQL Editor** ejecuta `database/migrations/002_institution_locations.sql` **una sola vez después de** `001_initial_schema.sql`.
4. Verifica la tabla nueva:

```sql
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE schemaname = 'app' AND tablename = 'organization_locations';
```

Deberías ver `rowsecurity = true` y `forcerowsecurity = true`. El esquema tendrá 30 tablas si partía de las 29 iniciales.

5. En **Git Bash** desde `apps/web`:

```bash
npm install
npm run build
npm run dev
```

> Esta versión añade `react-leaflet`, `leaflet` y `@types/leaflet`. Si reaparece ECONNRESET, conecta temporalmente el equipo a la red móvil con la que funcionó npm anteriormente.

6. En otra terminal, desde `apps/api` con tu `.venv` activo:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

Se agregó `tzdata` para validar zonas IANA en Windows.

7. Accede en el frontend con tu cuenta `superadmin`, abre **Instituciones** y pulsa **Nueva institución**. Completa los datos y **elige una posición exacta en el mapa o escribe latitud y longitud**. No se asignan coordenadas ficticias automáticamente.

## Rutas de API

| Método | URL | Autorización | Resultado |
|---|---|---|---|
| GET | `/api/v1/organizations` | sesión válida, institución autorizada | catálogo con ubicaciones (hasta 500, demo) |
| POST | `/api/v1/organizations` | superadmin global activo | 201, crea institución, sede y auditoría |
| PUT | `/api/v1/organizations/{id}` | superadmin global activo | 200, actualiza nombre y sede, audita |

El backend valida siempre JWT y roles. La creación es transaccional: si falla la sede, no queda la institución incompleta. No hay endpoints públicos que expongan ubicaciones.

## Caso de prueba para la presentación

Registrar instituciones de **prueba** en varios países: `Centro DEMO Lima` (Perú), `Instituto DEMO Bogotá` (Colombia) y `Academia DEMO Madrid` (España), seleccionando correctamente cada punto en el mapa. Son entidades ficticias que deben exhibirse como DEMO; no se deben presentar como instituciones reales.

## Validaciones y limitaciones

- Se comprueba formato de código institucional, longitud de nombres, país de dos letras, zona horaria y rangos de coordenadas.
- No hay geocodificación automática ni validación contra un catálogo completo ISO: el usuario selecciona coordenadas explícitamente.
- La vista contiene filtros locales, no paginación de servidor; el endpoint está limitado a 500 instituciones en esta primera demostración.
- Las losetas públicas de OpenStreetMap se utilizan solo para prototipo y bajo su política de uso. Incluyen atribución visible. Un servicio masivo necesitará proveedor autorizado/autohospedaje de teselas.
- No se realizaron pruebas contra la base de datos de tu Supabase desde este entorno.
- **No modificar `.env` ni volver a ejecutar `001_initial_schema.sql`.**

## Prueba mínima de aceptación

- [ ] `/health` responde 200.
- [ ] `/api/v1/me` responde 200 y declara `superadmin`.
- [ ] Tras ejecutar `002`, la lista vacía no produce 500.
- [ ] Registrar una institución en Perú devuelve 201 y aparece marcador.
- [ ] Registrar una segunda en otro país y filtrar por país.
- [ ] Seleccionar una fila centra el mapa en su sede.
- [ ] Editar sede actualiza registro y audit log.
- [ ] Usuario sin `superadmin` recibe 403 en POST y PUT.
- [ ] En móvil el mapa queda debajo del catálogo; tema Negro conserva controles neutrales.
