"""Sesiones SQLAlchemy; la URL proviene de secretos del servidor.

NO se usa service_role en el navegador ni se interpreta organization_id
como prueba de permisos. El backend consulta la membresía antes de cada operación.
"""
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine | None:
    """Pool pequeño para Render Free y PostgreSQL Free de Supabase."""
    url = get_settings().database_url
    if not url:
        return None
    if not url.startswith("postgresql+asyncpg://"):
        raise ValueError("DATABASE_URL requiere postgresql+asyncpg://")
    return create_async_engine(url, pool_size=2, max_overflow=0, pool_pre_ping=True)


def require_engine() -> AsyncEngine:
    """Devuelve 503 mientras aún no se configura la base de datos."""
    engine = get_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="Base de datos todavía no configurada")
    return engine
