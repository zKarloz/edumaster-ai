# EduMaster.ai — Corrección CI Ruff (hotfix v15.2)

Este parche corrige los **50 avisos de Ruff** mostrados en GitHub Actions:

- Los **49 avisos B008** proceden de `fastapi.Depends(...)` y `fastapi.Query(...)`, una forma declarativa soportada por FastAPI. `apps/api/pyproject.toml` configura una **excepción específica** recomendada por Ruff, sin desactivar el análisis general ni cambiar endpoints.
- El único **TRY004** aparece en `app/routers/profile_details.py`, en un validador de Pydantic. Se conserva `ValueError` para obtener un error de validación HTTP 422, con una excepción local `# noqa: TRY004` explicada en el código. En Pydantic v2, `TypeError` dentro de validadores NO se convierte automáticamente en `ValidationError`.

## Instalación sobre la versión actual

1. Haz una copia de seguridad del proyecto.
2. Extrae este ZIP **en la carpeta que contiene `edumaster-ai`**, respetando la estructura.
3. Revisa los cambios antes de subirlos.
4. Abre Git Bash en la raíz del proyecto y ejecuta:

```bash
cd apps/api
python -m ruff check app tests
python -m pytest -q
cd ../..
git status
git add apps/api/pyproject.toml apps/api/app/routers/profile_details.py
git commit -m "fix(ci): configure Ruff for FastAPI dependencies and Pydantic validator"
git push origin main
```

El pipeline de GitHub ejecuta Ruff desde `apps/api` y reconocerá automáticamente este `pyproject.toml`.

**No se modifican** `.env`, Supabase, migraciones, usuarios, roles ni los servicios ya desplegados.

Documentación: https://docs.astral.sh/ruff/settings/ (extend-immutable-calls) y https://docs.pydantic.dev/latest/concepts/validators/.
