"""Postflight v30.3: inspección SOLO LECTURA de migración 013.

Ejecutar desde apps/api con .venv activo, después de aplicar 013 en Supabase.
No imprime credenciales ni registros de estudiantes y no crea notas de prueba.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from sqlalchemy import text

from app.core.database import require_engine


async def main() -> None:
    engine = require_engine()
    async with engine.connect() as conn:
        result = (await conn.execute(text("""
            SELECT to_regclass('app.task_rubric_criteria') IS NOT NULL AS rubric,
                   to_regclass('app.task_official_grades') IS NOT NULL AS official_grades,
                   to_regclass('app.task_official_grade_history') IS NOT NULL AS revisions,
                   to_regclass('app.academic_activity_records') IS NOT NULL AS academic_records
        """))).mappings().one()
        print({key: bool(value) for key, value in result.items()})
        assert all(result.values()), "Faltan tablas de 013: aplica la migración antes de abrir la función"
        rows = (await conn.execute(text("""
            SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='app' AND c.relname IN
              ('task_rubric_criteria','task_official_grades','task_official_grade_history')
        """))).mappings().all()
        assert len(rows) == 3 and all(row["rls"] and row["forced"] for row in rows), "RLS no está forzado"
        duplicates = (await conn.execute(text("""
            SELECT EXISTS (
              SELECT 1 FROM app.task_official_grades
              GROUP BY organization_id,task_id,enrollment_id HAVING count(*)>1
            )
        """))).scalar_one()
        assert not duplicates, "Se detectaron notas oficiales duplicadas"
    print("OK: migración 013, aislamiento RLS y unicidad. No se modificaron datos.")


if __name__ == "__main__":
    asyncio.run(main())
