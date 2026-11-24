"""Diagnóstico de solo lectura con la cuenta configurada en FastAPI.

Ejecutar en apps/api: python ../../tools/verificacion/verificar_009_api.py
No imprime secretos, identificadores personales ni contenido de lecciones.
"""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))
from app.core.database import require_engine  # noqa: E402


async def main() -> None:
    """Comprueba presencia de tabla, privilegios de API y revisiones faltantes."""
    async with require_engine().connect() as connection:
        result = (await connection.execute(text("""
            SELECT current_user AS db_role,
                   to_regclass('app.lesson_revisions') IS NOT NULL AS table_exists,
                   has_schema_privilege(current_user,'app','USAGE') AS schema_usage
        """))).mappings().one()
        print(dict(result))
        if not result["table_exists"]:
            raise SystemExit("ERROR: falta la tabla app.lesson_revisions: no iniciar backend v29.1")
        privileges = (await connection.execute(text("""
            SELECT has_table_privilege(current_user,'app.lesson_revisions','SELECT') AS can_select,
                   has_table_privilege(current_user,'app.lesson_revisions','INSERT') AS can_insert,
                   has_table_privilege(current_user,'app.lesson_revisions','UPDATE') AS can_update
        """))).mappings().one()
        print(dict(privileges))
        if not result["schema_usage"] or not all(privileges.values()):
            raise SystemExit("ERROR: la cuenta de FastAPI no tiene los privilegios necesarios")
        counts = (await connection.execute(text("""
            SELECT
              (SELECT COUNT(*) FROM app.lessons l WHERE NOT EXISTS
                (SELECT 1 FROM app.lesson_revisions r
                 WHERE r.organization_id=l.organization_id AND r.institutional_lesson_id=l.id))
                AS institutional_missing,
              (SELECT COUNT(*) FROM app.offering_lessons l WHERE NOT EXISTS
                (SELECT 1 FROM app.lesson_revisions r
                 WHERE r.organization_id=l.organization_id AND r.offering_lesson_id=l.id))
                AS offering_missing
        """))).mappings().one()
        print(dict(counts))
        if any(counts.values()):
            raise SystemExit("ERROR: hay lecciones sin revisión; revisar la migración")
    print("OK: estructura y privilegios de FastAPI para migración 009")


if __name__ == "__main__":
    asyncio.run(main())
