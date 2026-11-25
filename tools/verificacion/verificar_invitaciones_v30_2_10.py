"""Comprobación local, sin modificar datos ni imprimir valores secretos."""

import asyncio
import sys
from pathlib import Path

# Al invocar este script desde apps/api, localizar explícitamente el paquete app.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import require_engine


async def main() -> None:
    settings = get_settings()
    assert settings.supabase_url.startswith("https://"), "SUPABASE_URL debe ser HTTPS"
    assert settings.supabase_secret_key, "Falta SUPABASE_SECRET_KEY en apps/api/.env"
    engine = require_engine()
    async with engine.connect() as conn:
        sql = text("""
            SELECT to_regclass('app.users') IS NOT NULL AS users_exists,
                   to_regclass('app.organization_memberships') IS NOT NULL AS memberships_exists,
                   to_regclass('app.membership_roles') IS NOT NULL AS roles_exists,
                   to_regclass('app.audit_logs') IS NOT NULL AS audit_exists,
                   has_schema_privilege(current_user,'app','USAGE') AS schema_usage
        """)
        result = dict((await conn.execute(sql)).mappings().one())
    print(result)
    assert all(result.values()), "Falta una tabla o permiso necesario"
    print("OK: estructuras y configuración local para invitaciones. No se enviaron correos.")


if __name__ == "__main__":
    asyncio.run(main())
