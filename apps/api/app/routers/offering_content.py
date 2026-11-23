"""v27 · Unidades y lecciones PROPIAS de una oferta académica.

Una asignación docente activa concede edición únicamente dentro de esa oferta.
La estructura institucional permanece separada. Toda escritura comprueba JWT,
institución, estado de oferta y asignación, se audita y es transaccional.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic_activity import ASSIGNED_INSTRUCTOR, _actor_scope
from app.routers.course_content import (
    LessonCreate,
    LessonUpdate,
    ModuleCreate,
    ModuleUpdate,
    MoveDirection,
    _audit,
    _swap_positions,
)

router = APIRouter(prefix="/api/v1/academic/organizations", tags=["offering-content"])
logger = logging.getLogger(__name__)


def _failure(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Error SQL en contenido de oferta")
    return HTTPException(status_code=503, detail="No se pudo guardar el contenido. Comprueba la migración 008")


async def _editor(conn: AsyncConnection, auth_id: UUID, org: UUID, offering_id: UUID,
                  *, lock: bool = False) -> UUID:
    """La asignación docente se valida en SQL en CADA acción; nunca en el cliente."""
    scope = await _actor_scope(conn, auth_id, org)
    row = (await conn.execute(text(f"""
        SELECT off.id, off.status, c.status AS course_status,
               {ASSIGNED_INSTRUCTOR} AS assigned
        FROM app.course_offerings off
        JOIN app.courses c ON c.organization_id=off.organization_id AND c.id=off.course_id
        WHERE off.organization_id=:org AND off.id=:offering_id
    """ + (" FOR UPDATE OF off" if lock else "")), {
        "org": org, "offering_id": offering_id, "actor": scope["actor_id"],
    })).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Oferta académica no disponible")
    if not (scope["is_manager"] or row["assigned"]):
        raise HTTPException(status_code=403, detail="No tienes permisos para editar esta oferta")
    if row["status"] not in ("planned", "open") or row["course_status"] == "archived":
        raise HTTPException(status_code=409, detail="La oferta debe estar activa para editar contenidos")
    return scope["actor_id"]


async def _offering_from_module(conn: AsyncConnection, org: UUID, module_id: UUID) -> UUID:
    row = (await conn.execute(text("""
        SELECT offering_id FROM app.offering_modules
        WHERE organization_id=:org AND id=:module_id
    """), {"org": org, "module_id": module_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Unidad de oferta no disponible")
    return row["offering_id"]


async def _offering_from_lesson(conn: AsyncConnection, org: UUID, lesson_id: UUID) -> UUID:
    row = (await conn.execute(text("""
        SELECT m.offering_id FROM app.offering_lessons l
        JOIN app.offering_modules m ON m.organization_id=l.organization_id AND m.id=l.module_id
        WHERE l.organization_id=:org AND l.id=:lesson_id
    """), {"org": org, "lesson_id": lesson_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Lección de oferta no disponible")
    return row["offering_id"]


async def offering_units(conn: AsyncConnection, org: UUID, offering_id: UUID,
                         *, preview: bool) -> list[dict]:
    """Lectura limitada a una oferta; sin borradores para alumnos matriculados."""
    params = {"org": org, "offering_id": offering_id, "preview": preview}
    units = (await conn.execute(text("""
        SELECT id::text AS id, title, description, position, status,
               updated_at::text AS updated_at
        FROM app.offering_modules
        WHERE organization_id=:org AND offering_id=:offering_id
          AND (:preview OR status='published')
        ORDER BY position, id LIMIT 200
    """), params)).mappings().all()
    lessons = (await conn.execute(text("""
        SELECT l.id::text AS id, l.module_id::text AS module_id, l.title,
               l.content, l.position, l.status, l.updated_at::text AS updated_at
        FROM app.offering_lessons l
        JOIN app.offering_modules m ON m.id=l.module_id AND m.organization_id=l.organization_id
        WHERE l.organization_id=:org AND m.offering_id=:offering_id
          AND (:preview OR (m.status='published' AND l.status='published'))
        ORDER BY m.position, l.position LIMIT 1000
    """), params)).mappings().all()
    result = {unit["id"]: {**dict(unit), "source": "offering", "lessons": []} for unit in units}
    for lesson in lessons:
        parent = result.get(lesson["module_id"])
        if parent is not None:
            parent["lessons"].append(dict(lesson))
    return list(result.values())


@router.post("/{organization_id}/course-offerings/{offering_id}/modules",
             status_code=status.HTTP_201_CREATED)
async def create_offering_module(
    organization_id: UUID, offering_id: UUID, payload: ModuleCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    try:
        async with engine.begin() as conn:
            actor = await _editor(conn, auth_id, organization_id, offering_id, lock=True)
            position = (await conn.execute(text("""
                SELECT COALESCE(MAX(position),0)+1 FROM app.offering_modules
                WHERE organization_id=:org AND offering_id=:offering_id
            """), {"org": organization_id, "offering_id": offering_id})).scalar_one()
            item = (await conn.execute(text("""
                INSERT INTO app.offering_modules
                   (organization_id, offering_id, title, description, position, status)
                VALUES (:org,:offering_id,:title,:description,:position,'draft')
                RETURNING id::text AS id, title, description, position, status
            """), {"org": organization_id, "offering_id": offering_id,
                   "position": position, **payload.model_dump()})).mappings().one()
            await _audit(conn, organization_id, actor, "create", "offering_modules", UUID(item["id"]))
        return dict(item)
    except SQLAlchemyError as exc:
        raise _failure(exc) from exc


@router.patch("/{organization_id}/offering-modules/{module_id}")
async def update_offering_module(
    organization_id: UUID, module_id: UUID, payload: ModuleUpdate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    changes = payload.model_dump(exclude_unset=True)
    if not changes or ("title" in changes and changes["title"] is None) or ("status" in changes and changes["status"] is None):
        raise HTTPException(status_code=422, detail="Indica cambios válidos de unidad")
    assignment = ", ".join(f"{key}=:{key}" for key in changes)
    try:
        async with engine.begin() as conn:
            # Comprobar el rol antes de permitir modificar datos de esta oferta.
            offering_id = await _offering_from_module(conn, organization_id, module_id)
            actor = await _editor(conn, auth_id, organization_id, offering_id, lock=True)
            current = (await conn.execute(text("""
                SELECT status FROM app.offering_modules
                WHERE organization_id=:org AND id=:module_id FOR UPDATE
            """), {"org": organization_id, "module_id": module_id})).mappings().first()
            if not current:
                raise HTTPException(status_code=404, detail="Unidad de oferta no disponible")
            if current["status"] == "published" and any(k in changes for k in ("title", "description")):
                raise HTTPException(status_code=409, detail="Primero devuelve la unidad a borrador")
            item = (await conn.execute(text(f"""
                UPDATE app.offering_modules SET {assignment}
                WHERE organization_id=:org AND id=:module_id AND offering_id=:offering_id
                RETURNING id::text AS id, title, description, position, status
            """), {"org": organization_id, "module_id": module_id,
                   "offering_id": offering_id, **changes})).mappings().first()
            if not item:
                raise HTTPException(status_code=404, detail="Unidad de oferta no disponible")
            await _audit(conn, organization_id, actor, "update", "offering_modules", module_id)
        return dict(item)
    except SQLAlchemyError as exc:
        raise _failure(exc) from exc


@router.post("/{organization_id}/offering-modules/{module_id}/lessons",
             status_code=status.HTTP_201_CREATED)
async def create_offering_lesson(
    organization_id: UUID, module_id: UUID, payload: LessonCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    try:
        async with engine.begin() as conn:
            offering_id = await _offering_from_module(conn, organization_id, module_id)
            actor = await _editor(conn, auth_id, organization_id, offering_id, lock=True)
            # Bloquear la unidad también: la creación concurrente mantiene orden estable.
            parent = (await conn.execute(text("""
                SELECT id FROM app.offering_modules
                WHERE organization_id=:org AND offering_id=:offering_id AND id=:module_id
                FOR UPDATE
            """), {"org": organization_id, "offering_id": offering_id,
                   "module_id": module_id})).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Unidad de oferta no disponible")
            position = (await conn.execute(text("""
                SELECT COALESCE(MAX(position),0)+1 FROM app.offering_lessons
                WHERE organization_id=:org AND module_id=:module_id
            """), {"org": organization_id, "module_id": module_id})).scalar_one()
            item = (await conn.execute(text("""
                INSERT INTO app.offering_lessons
                   (organization_id,module_id,title,content,position,status)
                VALUES (:org,:module_id,:title,:content,:position,'draft')
                RETURNING id::text AS id, module_id::text AS module_id,
                          title, content, position, status
            """), {"org": organization_id, "module_id": module_id,
                   "position": position, **payload.model_dump()})).mappings().one()
            await _audit(conn, organization_id, actor, "create", "offering_lessons", UUID(item["id"]))
        return dict(item)
    except SQLAlchemyError as exc:
        raise _failure(exc) from exc


@router.patch("/{organization_id}/offering-lessons/{lesson_id}")
async def update_offering_lesson(
    organization_id: UUID, lesson_id: UUID, payload: LessonUpdate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    changes = payload.model_dump(exclude_unset=True)
    if not changes or ("title" in changes and changes["title"] is None) or ("status" in changes and changes["status"] is None):
        raise HTTPException(status_code=422, detail="Indica cambios válidos de lección")
    assignment = ", ".join(f"{key}=:{key}" for key in changes)
    try:
        async with engine.begin() as conn:
            offering_id = await _offering_from_lesson(conn, organization_id, lesson_id)
            actor = await _editor(conn, auth_id, organization_id, offering_id, lock=True)
            current = (await conn.execute(text("""
                SELECT status FROM app.offering_lessons
                WHERE organization_id=:org AND id=:lesson_id FOR UPDATE
            """), {"org": organization_id, "lesson_id": lesson_id})).mappings().first()
            if not current:
                raise HTTPException(status_code=404, detail="Lección de oferta no disponible")
            if current["status"] == "published" and any(k in changes for k in ("title", "content")):
                raise HTTPException(status_code=409, detail="Primero devuelve la lección a borrador")
            item = (await conn.execute(text(f"""
                UPDATE app.offering_lessons SET {assignment}
                WHERE organization_id=:org AND id=:lesson_id AND EXISTS (
                    SELECT 1 FROM app.offering_modules m
                    WHERE m.organization_id=:org AND m.id=app.offering_lessons.module_id
                      AND m.offering_id=:offering_id
                )
                RETURNING id::text AS id, module_id::text AS module_id,
                          title, content, position, status
            """), {"org": organization_id, "lesson_id": lesson_id,
                   "offering_id": offering_id, **changes})).mappings().first()
            if not item:
                raise HTTPException(status_code=404, detail="Lección de oferta no disponible")
            await _audit(conn, organization_id, actor, "update", "offering_lessons", lesson_id)
        return dict(item)
    except SQLAlchemyError as exc:
        raise _failure(exc) from exc


@router.patch("/{organization_id}/course-offerings/{offering_id}/modules/{module_id}/move")
async def move_offering_module(
    organization_id: UUID, offering_id: UUID, module_id: UUID, payload: MoveDirection,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    try:
        async with engine.begin() as conn:
            actor = await _editor(conn, auth_id, organization_id, offering_id, lock=True)
            changed = await _swap_positions(conn, organization_id, table="offering_modules",
                parent_field="offering_id", parent_id=offering_id, record_id=module_id,
                direction=payload.direction)
            if changed:
                await _audit(conn, organization_id, actor, "reorder", "offering_modules", module_id)
        return {"changed": changed}
    except SQLAlchemyError as exc:
        raise _failure(exc) from exc


@router.patch("/{organization_id}/offering-modules/{module_id}/lessons/{lesson_id}/move")
async def move_offering_lesson(
    organization_id: UUID, module_id: UUID, lesson_id: UUID, payload: MoveDirection,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    try:
        async with engine.begin() as conn:
            offering_id = await _offering_from_module(conn, organization_id, module_id)
            actor = await _editor(conn, auth_id, organization_id, offering_id, lock=True)
            changed = await _swap_positions(conn, organization_id, table="offering_lessons",
                parent_field="module_id", parent_id=module_id, record_id=lesson_id,
                direction=payload.direction)
            if changed:
                await _audit(conn, organization_id, actor, "reorder", "offering_lessons", lesson_id)
        return {"changed": changed}
    except SQLAlchemyError as exc:
        raise _failure(exc) from exc
