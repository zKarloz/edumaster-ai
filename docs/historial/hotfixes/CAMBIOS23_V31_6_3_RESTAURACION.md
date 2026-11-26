# v31.6.3 — Hotfix restauración y avisos

- PATCH /api/v1/neural-demo/models/{model_id}/restore: solo superadmin, restaura archived_at a NULL y audita en la misma transacción. No cambia el checkpoint ni crea otro registro.
- Restaurar no equivale a recuperar el modelo en memoria; después se puede usar Recuperar.
- Registro central usa Toast compartido para guardar, recuperar, archivar, restaurar, actualizar y errores. Si falla el refresco tras una mutación exitosa, se informa por separado.
- No requiere migración ni dependencias nuevas. Aplicar después del hotfix Ruff.
- Validar Ruff, pytest, pruebas frontend, build y operaciones con superadmin. Comprobar auditoría y que los usuarios no autorizados no puedan restaurar.
