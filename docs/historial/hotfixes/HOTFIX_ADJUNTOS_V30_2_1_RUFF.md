# Hotfix v30.2.1 — Formato Ruff en adjuntos de tareas

Base: CAMBIOS 21 v30.2 sobre commit `20ac55b`.

Se corrigen exclusivamente cuatro avisos del linter:
- `I001` en `app/routers/task_attachments.py`, usando imports multilínea ordenados.
- Tres avisos `RUF012` en `tests/test_cambios21_task_attachments_v30_2.py`: se crean las cabeceras de las solicitudes de prueba por instancia y no como diccionario mutable de clase.

No modifica contratos API, SQL, reglas de entrega, Storage ni dependencias. Se mantiene la migración 012 aplicada; **no volver a ejecutarla**.

Comprobación desde `apps/api` (entorno `.venv`):

```bash
python -m ruff check app tests
python -m pytest -q
python ../../tools/verificacion/verificar_012_api.py
```
