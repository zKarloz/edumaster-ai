"""Comprobación de lectura de la migración 011 desde el rol efectivo FastAPI.

Ejecutar desde apps/api: python ../../tools/verificacion/verificar_011_api.py
No muestra credenciales, rutas de archivos ni respuestas de estudiantes.
"""

import asyncio
import sys
from pathlib import Path

# Permite invocar el script por ruta desde apps/api.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from sqlalchemy import text

from app.core.database import require_engine


async def main() -> None:
    engine = require_engine()
    async with engine.connect() as connection:
        result = (await connection.execute(text("""
            SELECT current_user AS db_role,
                   to_regclass('app.course_tasks') IS NOT NULL AS tasks_exists,
                   to_regclass('app.task_submissions') IS NOT NULL AS submissions_exists,
                   has_schema_privilege(current_user,'app','USAGE') AS schema_usage,
                   (has_table_privilege(current_user,'app.course_tasks','SELECT')
                   AND has_table_privilege(current_user,'app.course_tasks','INSERT')
                   AND has_table_privilege(current_user,'app.course_tasks','UPDATE')) AS tasks_rw,
                   (has_table_privilege(current_user,'app.task_submissions','SELECT')
                   AND has_table_privilege(current_user,'app.task_submissions','INSERT')
                   AND has_table_privilege(current_user,'app.task_submissions','UPDATE')) AS submissions_rw
        """))).mappings().one()
        print(dict(result))
        assert all(bool(result[name]) for name in (
            "tasks_exists", "submissions_exists", "schema_usage", "tasks_rw", "submissions_rw"
        )), "Falta migración 011 o permisos del usuario FastAPI"
        count = (await connection.execute(text("""
            SELECT count(*) AS broken FROM app.task_submissions s
            LEFT JOIN app.course_tasks t ON t.organization_id=s.organization_id
                AND t.id=s.task_id AND t.offering_id=s.offering_id
            LEFT JOIN app.enrollments e ON e.organization_id=s.organization_id
                AND e.id=s.enrollment_id AND e.offering_id=s.offering_id
            WHERE t.id IS NULL OR e.id IS NULL
        """))).scalar_one()
        assert count == 0, "Existen entregas incompatibles con tareas o matrículas"
        print("OK: migración 011, permisos y alcance de entregas")


if __name__ == "__main__":
    asyncio.run(main())
