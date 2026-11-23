# PARCHE v5 — mapa internacional + ancho medio

1. Realiza una copia de seguridad de tu carpeta `edumaster-ai`.
2. Descomprime este ZIP en la carpeta que contiene `edumaster-ai`, conservando rutas.
3. NO sustituyas tus archivos `.env` (este ZIP no contiene `.env`).
4. En Supabase SQL Editor ejecuta `database/migrations/002_institution_locations.sql`; NO vuelvas a ejecutar `001_initial_schema.sql`.
5. Dentro de `apps/web` ejecuta `npm install && npm run build && npm run dev`. Hay nuevas dependencias Leaflet.
6. Dentro de `apps/api` activa .venv y ejecuta `python -m pip install -r requirements-dev.txt`, `python -m pytest -q` y `python -m uvicorn app.main:app --reload --port 8000`.
7. Ingresa como superadmin > Instituciones > Nueva institución. Marca su ubicación y guarda.

Más información: `edumaster-ai/docs/MAPA_INSTITUCIONES_SPRINT1.md`.
