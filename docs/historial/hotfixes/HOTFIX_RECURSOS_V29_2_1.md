# Hotfix v29.2.1 — Recursos académicos

**Base:** CAMBIOS 20 v29.2, posterior a la migración 010.

Corrige la ordenación de importaciones en `app/main.py` y `test_cambios20_resources_v29_2.py`,
usa `TypeError` para una respuesta de tipo inválido del servicio de Storage en
`lesson_resources.py`, y comprueba `VITE_SUPABASE_URL` antes de construir la URL
de validación del enlace firmado en el frontend. No cambia rutas ni contratos.

No requiere nuevas dependencias, migraciones SQL o cambios en Supabase.
Los tests backend disponibles superan 288/288. El build de Vite y Ruff deben
comprobarse en Git Bash del usuario después de aplicar la corrección.
