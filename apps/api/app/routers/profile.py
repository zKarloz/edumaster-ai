"""Autogestión del nombre: el sujeto se obtiene exclusivamente del JWT."""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id

router = APIRouter(prefix="/api/v1/me", tags=["profile"])
logger = logging.getLogger(__name__)


class ProfileUpdate(BaseModel):
    # No se permite enviar ID, correo, contraseña ni roles en este endpoint.
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=2, max_length=180)


@router.patch("/profile")
async def update_profile(
    payload: ProfileUpdate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Actualiza el propio nombre y audita la operación atómicamente."""
    try:
        async with engine.begin() as conn:
            user = (await conn.execute(text("""
                UPDATE app.users AS u SET full_name = :name, updated_at = now()
                WHERE u.auth_user_id = :auth_id AND u.status = 'active'
                  AND (EXISTS (
                    SELECT 1 FROM app.global_role_assignments g WHERE g.user_id = u.id
                  ) OR EXISTS (
                    SELECT 1 FROM app.organization_memberships m
                    JOIN app.organizations o ON o.id = m.organization_id
                    WHERE m.user_id = u.id AND m.status = 'active' AND o.status = 'active'
                  ))
                RETURNING u.id, u.full_name, u.email_normalized
            """), {"name": payload.name, "auth_id": auth_id})).mappings().first()
            if not user:
                raise HTTPException(status_code=403, detail="Cuenta sin acceso activo")
            await conn.execute(text("""
                INSERT INTO app.audit_logs (actor_id, action, resource, resource_id, metadata)
                VALUES (:id, 'update_profile', 'users', :id, '{"field":"full_name"}'::jsonb)
            """), {"id": user["id"]})
        return {"name": user["full_name"], "email": user["email_normalized"]}
    except SQLAlchemyError as exc:
        logger.exception("No se pudo actualizar el perfil")
        raise HTTPException(status_code=503, detail="No se pudo guardar el nombre") from exc
