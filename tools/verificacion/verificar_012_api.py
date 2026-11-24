"""Verifica migración 012 con la conexión real del servidor FastAPI.

Uso desde apps/api: python ../../tools/verificacion/verificar_012_api.py
No imprime secretos, respuestas ni rutas de los objetos en Storage.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from sqlalchemy import text

from app.core.database import require_engine


async def main() -> None:
    engine = require_engine()
    async with engine.connect() as connection:
        row = (await connection.execute(text("""
            SELECT current_user AS db_role,
              to_regclass('app.task_submission_files') IS NOT NULL AS table_exists,
              has_schema_privilege(current_user,'app','USAGE') AS schema_usage,
              (has_table_privilege(current_user,'app.task_submission_files','SELECT')
                AND has_table_privilege(current_user,'app.task_submission_files','INSERT')
                AND has_table_privilege(current_user,'app.task_submission_files','UPDATE')
                AND has_table_privilege(current_user,'app.task_submission_files','DELETE')) AS files_rw,
              (has_table_privilege(current_user,'app.resource_files','SELECT')
                AND has_table_privilege(current_user,'app.resource_files','INSERT')
                AND has_table_privilege(current_user,'app.resource_files','DELETE')) AS storage_metadata_rw,
              (SELECT public=FALSE FROM storage.buckets
                WHERE id='course-resources') AS bucket_private
        """))).mappings().one()
        print(dict(row))
        assert all(bool(row[name]) for name in (
            "table_exists", "schema_usage", "files_rw", "storage_metadata_rw", "bucket_private",
        )), "Falta migración 012, permiso de FastAPI o bucket privado"
        invalid = int((await connection.execute(text("""
            SELECT count(*) FROM app.task_submission_files a
            LEFT JOIN app.task_submissions s ON s.organization_id=a.organization_id
              AND s.id=a.submission_id AND s.task_id=a.task_id
              AND s.offering_id=a.offering_id AND s.enrollment_id=a.enrollment_id
            WHERE a.submission_id IS NOT NULL AND s.id IS NULL
        """))).scalar_one())
        assert invalid == 0, "Se detectaron adjuntos asociados a intentos de otra matrícula"
    print("OK: migración 012, bucket privado y aislamiento de adjuntos")


if __name__ == "__main__":
    asyncio.run(main())
