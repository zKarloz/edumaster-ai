"""v29.3 · Comprobación de solo lectura de privilegios de la API.

Ejecutar desde apps/api: python ../../tools/verificacion/verificar_publicacion_v29_3.py
No imprime credenciales ni datos de lecciones.
"""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))
from app.core.database import require_engine  # noqa: E402


async def main() -> None:
    """Evita desplegar la restauración si falta privilegio DELETE."""
    async with require_engine().connect() as connection:
        checks = (await connection.execute(text("""
            SELECT current_user AS db_role,
              has_table_privilege(current_user,'app.lesson_revisions','SELECT') AS revisions_select,
              has_table_privilege(current_user,'app.lesson_revisions','INSERT') AS revisions_insert,
              has_table_privilege(current_user,'app.lesson_revisions','UPDATE') AS revisions_update,
              has_table_privilege(current_user,'app.lesson_revisions','DELETE') AS revisions_delete,
              has_table_privilege(current_user,'app.lesson_revision_resources','SELECT') AS resources_select,
              has_table_privilege(current_user,'app.lesson_revision_resources','INSERT') AS resources_insert,
              has_table_privilege(current_user,'app.lesson_revision_resources','DELETE') AS resources_delete
        """))).mappings().one()
        privileges = {key: value for key, value in checks.items() if key != "db_role"}
        print("Rol API:", checks["db_role"])
        print("Privilegios v29.3:", privileges)
        if not all(privileges.values()):
            raise SystemExit("ERROR: faltan permisos PostgreSQL para publicar/restaurar")
        print("OK: permisos de publicación y restauración verificados")


if __name__ == "__main__":
    asyncio.run(main())
