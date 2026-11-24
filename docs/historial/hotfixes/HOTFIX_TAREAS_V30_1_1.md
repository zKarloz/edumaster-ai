# Hotfix v30.1.1 — Backend de tareas

## Alcance

Corrige cuatro avisos Ruff `UP017` y cinco pruebas asíncronas que en v30.1
requerían `pytest-asyncio` sin que el entorno lo tuviera instalado.

- `app/routers/course_tasks.py`: emplea `datetime.UTC` en vez de `timezone.utc`.
- `tests/test_cambios21_tasks_v30_1.py`: emplea `UTC` en las fechas y
  `asyncio.run` para probar endpoints asíncronos sin plugin adicional.

No cambia migración 011, API, frontend, credenciales, datos ni dependencias.
Pruebas del proyecto completo en entorno de validación con `-p no:asyncio`: 332/332.
La comprobación Ruff debe repetirse en VSCode, que dispone de la versión
configurada en el proyecto.
