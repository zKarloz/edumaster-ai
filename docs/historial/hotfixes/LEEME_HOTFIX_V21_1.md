# Corrección v21.1 — Ruff F401 y arranque local

Se eliminó una importación sin uso de `apps/api/app/routers/course_appearance.py`.
La causa del error `ERR_CONNECTION_REFUSED` es que no hay FastAPI escuchando en `localhost:8000`.

Desde `apps/api` (Git Bash):

```bash
python -m ruff check app tests
python -m pytest -q
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Deja abierta esta terminal. Comprueba `http://localhost:8000/health`. Inicia React en otra terminal (apps/web, `npm run dev`).

Tras validar y desde la raíz del repositorio:

```bash
git add apps/api/app/routers/course_appearance.py
git commit -m "fix(api): eliminar importación no utilizada en apariencia de cursos"
git push origin main
```

No requiere SQL, npm install ni editar `.env`. No subir archivos `.env` a GitHub.
