"""CAMBIOS 13: apariencia del curso base y de la oferta académica.

Ninguna preferencia visual cambia calificaciones, contenidos o matrículas.
Los gestores editan el curso base; únicamente docentes asignados editan
la oferta concreta. Los estudiantes pueden ver, pero nunca escribir.
"""
import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic import _require_scope
from app.routers.academic_activity import ASSIGNED_INSTRUCTOR

router = APIRouter(prefix="/api/v1/academic/organizations", tags=["course-appearance"])
logger = logging.getLogger(__name__)

Icon = Literal[
    "book-open", "calculator", "code-2", "atom", "flask-conical", "languages",
    "earth", "landmark", "palette", "music", "heart-pulse",
    "chart-no-axes-column-increasing",
]
Color = Literal[
    "blue", "teal", "purple", "amber", "rose", "indigo", "green", "slate", "orange", "cyan",
]


class AppearanceSelection(BaseModel):
    """Solo admite claves de la paleta revisada; rechaza atributos inesperados."""
    model_config = ConfigDict(extra="forbid")
    icon: Icon
    color: Color


async def _audit(conn, organization_id: UUID, actor: UUID, resource: str, resource_id: UUID, action: str):
    """La actualización y su auditoría se confirman en la misma transacción."""
    await conn.execute(text("""
        INSERT INTO app.audit_logs (organization_id,actor_id,action,resource,resource_id)
        VALUES (:organization_id,:actor,:action,:resource,:resource_id)
    """), {"organization_id": organization_id, "actor": actor,
           "action": action, "resource": resource, "resource_id": resource_id})


@router.patch("/{organization_id}/courses/{course_id}/appearance")
async def update_course_appearance(
    organization_id: UUID, course_id: UUID, payload: AppearanceSelection,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Gestores institucionales definen la apariencia base de un curso."""
    try:
        async with engine.begin() as conn:
            actor = await _require_scope(conn, auth_id, organization_id, manage=True)
            row = (await conn.execute(text("""
                UPDATE app.courses
                SET appearance_icon=:icon, appearance_color=:color, updated_at=now()
                WHERE organization_id=:organization_id AND id=:course_id
                RETURNING id, appearance_icon, appearance_color
            """), {"organization_id": organization_id, "course_id": course_id,
                   **payload.model_dump()})).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Curso no disponible")
            await _audit(conn, organization_id, actor, "courses", course_id, "update_appearance")
        return {"course_id": str(row["id"]), "icon": row["appearance_icon"],
                "color": row["appearance_color"]}
    except SQLAlchemyError as exc:
        logger.exception("Error al actualizar apariencia base")
        raise HTTPException(status_code=503, detail="No se pudo guardar la apariencia del curso") from exc


async def _assigned_offering(conn, organization_id: UUID, auth_id: UUID, offering_id: UUID):
    """Validación cruzada: JWT + institución + docente asignado y activo."""
    actor = await _require_scope(conn, auth_id, organization_id)
    row = (await conn.execute(text(f"""
        SELECT off.id, {ASSIGNED_INSTRUCTOR} AS assigned
        FROM app.course_offerings off
        WHERE off.organization_id=:organization_id AND off.id=:offering_id
          AND off.status <> 'cancelled'
        FOR UPDATE OF off
    """), {"organization_id": organization_id, "offering_id": offering_id,
           "actor": actor})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Oferta académica no disponible")
    if not row["assigned"]:
        raise HTTPException(status_code=403,
                            detail="Solo el docente asignado puede personalizar esta oferta")
    return actor


@router.put("/{organization_id}/course-offerings/{offering_id}/appearance")
async def update_offering_appearance(
    organization_id: UUID, offering_id: UUID, payload: AppearanceSelection,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Personalización de la oferta sin modificar la apariencia base del curso."""
    try:
        async with engine.begin() as conn:
            actor = await _assigned_offering(conn, organization_id, auth_id, offering_id)
            await conn.execute(text("""
                UPDATE app.course_offerings
                SET appearance_icon_override=:icon, appearance_color_override=:color
                WHERE organization_id=:organization_id AND id=:offering_id
            """), {"organization_id": organization_id, "offering_id": offering_id,
                   **payload.model_dump()})
            await _audit(conn, organization_id, actor, "course_offerings", offering_id, "update_appearance")
        return {"offering_id": str(offering_id), **payload.model_dump(), "overridden": True}
    except SQLAlchemyError as exc:
        logger.exception("Error al actualizar apariencia de oferta")
        raise HTTPException(status_code=503, detail="No se pudo guardar la apariencia de la oferta") from exc


@router.delete("/{organization_id}/course-offerings/{offering_id}/appearance")
async def restore_offering_appearance(
    organization_id: UUID, offering_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Quita excepciones de diseño y vuelve a heredar los valores institucionales."""
    try:
        async with engine.begin() as conn:
            actor = await _assigned_offering(conn, organization_id, auth_id, offering_id)
            await conn.execute(text("""
                UPDATE app.course_offerings
                SET appearance_icon_override=NULL, appearance_color_override=NULL
                WHERE organization_id=:organization_id AND id=:offering_id
            """), {"organization_id": organization_id, "offering_id": offering_id})
            await _audit(conn, organization_id, actor, "course_offerings", offering_id, "restore_appearance")
        return {"offering_id": str(offering_id), "overridden": False}
    except SQLAlchemyError as exc:
        logger.exception("Error al restaurar apariencia de oferta")
        raise HTTPException(status_code=503, detail="No se pudo restaurar la apariencia de la oferta") from exc
