"""v26 · Espacio académico por oferta y contenido reutilizable del curso base.

Gestores institucionales editan el curso base. Docentes asignados consultan
su oferta y contenido (incluidos borradores para preparación); estudiantes
matriculados solo ven contenido publicado. Toda comprobación se hace en SQL
con organización + UUID del JWT. No habilita escritura directa desde Supabase.
"""

import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic import _require_scope
from app.routers.academic_activity import ASSIGNED_INSTRUCTOR, _actor_scope
from app.services.lesson_revision_compat import create_initial_draft, sync_legacy_update

router = APIRouter(prefix="/api/v1/academic/organizations", tags=["course-content"])
logger = logging.getLogger(__name__)
ContentStatus = Literal["draft", "published", "archived"]


class ModuleCreate(BaseModel):
    """El orden es automático: nunca se acepta posición desde el cliente."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=2000)


class ModuleUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str | None = Field(default=None, min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=2000)
    status: ContentStatus | None = None


class LessonCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(min_length=3, max_length=180)
    content: str | None = Field(default=None, max_length=20000)


class LessonUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str | None = Field(default=None, min_length=3, max_length=180)
    content: str | None = Field(default=None, max_length=20000)
    status: ContentStatus | None = None


class MoveDirection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    direction: Literal["up", "down"]


def _database_failure(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Fallo al consultar o modificar contenido académico")
    return HTTPException(status_code=503, detail="No se pudo consultar el contenido. Verifica la migración 007")


async def _audit(conn: AsyncConnection, org: UUID, actor: UUID, action: str,
                 resource: str, record_id: UUID) -> None:
    """Guarda la acción junto a la modificación y sin contenido personal."""
    await conn.execute(text("""
        INSERT INTO app.audit_logs (organization_id, actor_id, action, resource, resource_id)
        VALUES (:org, :actor, :action, :resource, :record_id)
    """), {"org": org, "actor": actor, "action": action,
           "resource": resource, "record_id": record_id})


async def _manager_course(conn: AsyncConnection, auth_id: UUID,
                          org: UUID, course_id: UUID, *, lock: bool = False) -> UUID:
    """Solo gestores activos; nunca docentes modificando contenidos comunes sin delegación."""
    actor = await _require_scope(conn, auth_id, org, manage=True)
    query = """
        SELECT id FROM app.courses
        WHERE organization_id=:org AND id=:course_id AND status<>'archived'
    """ + (" FOR UPDATE" if lock else "")
    found = (await conn.execute(text(query), {"org": org, "course_id": course_id})).first()
    if not found:
        raise HTTPException(status_code=404, detail="Curso no disponible para edición")
    return actor


async def _course_from_module(conn: AsyncConnection, org: UUID, module_id: UUID) -> UUID:
    row = (await conn.execute(text("""
        SELECT course_id FROM app.course_modules
        WHERE organization_id=:org AND id=:module_id
    """), {"org": org, "module_id": module_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Unidad no disponible")
    return row["course_id"]


async def _course_from_lesson(conn: AsyncConnection, org: UUID, lesson_id: UUID) -> UUID:
    row = (await conn.execute(text("""
        SELECT m.course_id FROM app.lessons l
        JOIN app.course_modules m ON m.organization_id=l.organization_id AND m.id=l.module_id
        WHERE l.organization_id=:org AND l.id=:lesson_id
    """), {"org": org, "lesson_id": lesson_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Lección no disponible")
    return row["course_id"]


async def _content(conn: AsyncConnection, org: UUID, course_id: UUID,
                   *, preview: bool) -> list[dict]:
    """Sólo contenido del curso autorizado; borradores nunca llegan a estudiantes."""
    params = {"org": org, "course_id": course_id, "preview": preview}
    units = (await conn.execute(text("""
        SELECT id::text AS id, title, description, position, status,
               updated_at::text AS updated_at
        FROM app.course_modules
        WHERE organization_id=:org AND course_id=:course_id
          AND (:preview OR status='published')
        ORDER BY position, id LIMIT 200
    """), params)).mappings().all()
    # Consulta separada ligada al curso, no al conjunto de IDs arbitrarios del cliente.
    lessons = (await conn.execute(text("""
        SELECT l.id::text AS id, l.module_id::text AS module_id, l.title,
               l.content, l.position, l.status, l.updated_at::text AS updated_at
        FROM app.lessons l
        JOIN app.course_modules m ON m.id=l.module_id AND m.organization_id=l.organization_id
        WHERE l.organization_id=:org AND m.course_id=:course_id
          AND (:preview OR (m.status='published' AND l.status='published'))
        ORDER BY m.position, l.position LIMIT 1000
    """), params)).mappings().all()
    by_module = {unit["id"]: {**dict(unit), "lessons": []} for unit in units}
    for lesson in lessons:
        module = by_module.get(lesson["module_id"])
        if module is not None:
            module["lessons"].append(dict(lesson))
    return [{**unit, "source": "base"} for unit in by_module.values()]


@router.get("/{organization_id}/course-offerings/{offering_id}/workspace")
async def offering_workspace(
    organization_id: UUID, offering_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """El docente necesita asignación; el estudiante una matrícula válida en ESTA oferta."""
    query = text(f"""
        SELECT off.id::text AS offering_id, off.course_id::text AS course_id,
               c.title, c.code, c.description, c.status AS course_status,
               off.status AS offering_status, off.period,
               COALESCE(off.appearance_icon_override,c.appearance_icon) AS appearance_icon,
               COALESCE(off.appearance_color_override,c.appearance_color) AS appearance_color,
               {ASSIGNED_INSTRUCTOR} AS assigned,
               EXISTS (
                 SELECT 1 FROM app.enrollments e
                 JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
                   AND s.status='active'
                 JOIN app.organization_memberships sm ON sm.id=s.membership_id
                   AND sm.organization_id=s.organization_id AND sm.status='active'
                 WHERE e.organization_id=off.organization_id AND e.offering_id=off.id
                   AND e.status IN ('active','completed') AND sm.user_id=:actor
               ) AS enrolled
        FROM app.course_offerings off
        JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
        WHERE off.organization_id=:org AND off.id=:offering_id AND off.status<>'cancelled'
    """)
    try:
        async with engine.connect() as conn:
            scope = await _actor_scope(conn, auth_id, organization_id)
            row = (await conn.execute(query, {"org": organization_id, "offering_id": offering_id,
                "actor": scope["actor_id"]})).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Oferta académica no disponible")
            manager = bool(scope["is_manager"])
            assigned = bool(row["assigned"])
            enrolled = bool(row["enrolled"])
            if not (manager or assigned or enrolled):
                raise HTTPException(status_code=403, detail="No tienes acceso a esta oferta")
            if enrolled and not (manager or assigned) and row["course_status"] != "published":
                raise HTTPException(status_code=404, detail="Curso no publicado")
            # La matrícula no autoriza borradores; el personal asignado sí puede previsualizarlos.
            preview = manager or assigned
            units = await _content(conn, organization_id, UUID(row["course_id"]), preview=preview)
            # El material docente se lee exclusivamente de la oferta visitada.
            # La autorización de lectura ya se comprobó antes de ejecutar ambas consultas.
            from app.routers.offering_content import offering_units
            units.extend(await offering_units(conn, organization_id, offering_id, preview=preview))
        return {"course": {key: value for key, value in row.items() if key not in ("assigned", "enrolled")},
                "role": "manager" if manager else "instructor" if assigned else "student",
                "can_edit_base": manager and row["course_status"] != "archived",
                "can_edit_offering": (manager or assigned) and row["offering_status"] in ("planned", "open")
                  and row["course_status"] != "archived",
                "units": units}
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


@router.get("/{organization_id}/courses/{course_id}/workspace")
async def base_course_workspace(
    organization_id: UUID, course_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Editor institucional del curso base; no mezcla ofertas ni sus matrículas."""
    try:
        async with engine.connect() as conn:
            await _require_scope(conn, auth_id, organization_id, manage=True)
            row = (await conn.execute(text("""
                SELECT c.id::text AS course_id, c.title, c.code, c.description,
                       c.status AS course_status, c.appearance_icon, c.appearance_color
                FROM app.courses c WHERE c.organization_id=:org AND c.id=:course_id
            """), {"org": organization_id, "course_id": course_id})).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Curso no disponible")
            units = await _content(conn, organization_id, course_id, preview=True)
        return {"course": dict(row), "role": "manager", "can_edit_base": row["course_status"] != "archived", "can_edit_offering": False, "units": units}
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


@router.post("/{organization_id}/courses/{course_id}/modules", status_code=status.HTTP_201_CREATED)
async def create_module(
    organization_id: UUID, course_id: UUID, payload: ModuleCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Crea una unidad como borrador y al final de la lista, sin riesgo de colisión."""
    try:
        async with engine.begin() as conn:
            actor = await _manager_course(conn, auth_id, organization_id, course_id, lock=True)
            pos = (await conn.execute(text("""
                SELECT COALESCE(MAX(position),0)+1 FROM app.course_modules
                WHERE organization_id=:org AND course_id=:course_id
            """), {"org": organization_id, "course_id": course_id})).scalar_one()
            item = (await conn.execute(text("""
                INSERT INTO app.course_modules
                  (organization_id, course_id, title, description, position, status)
                VALUES (:org, :course_id, :title, :description, :position, 'draft')
                RETURNING id::text AS id, title, description, position, status
            """), {"org": organization_id, "course_id": course_id,
                    "position": pos, **payload.model_dump()})).mappings().one()
            await _audit(conn, organization_id, actor, "create", "course_modules", UUID(item["id"]))
        return dict(item)
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


@router.patch("/{organization_id}/course-modules/{module_id}")
async def update_module(
    organization_id: UUID, module_id: UUID, payload: ModuleUpdate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Actualizaciones parciales de unidad sin cambiar la propiedad del curso."""
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Indica al menos un cambio")
    if ("title" in changes and changes["title"] is None) or ("status" in changes and changes["status"] is None):
        raise HTTPException(status_code=422, detail="Título y estado no pueden ser nulos")
    assignments = ", ".join(f"{name}=:{name}" for name in changes)
    try:
        async with engine.begin() as conn:
            # Autorizar primero: ni siquiera se revela la existencia de una unidad.
            await _require_scope(conn, auth_id, organization_id, manage=True)
            course_id = await _course_from_module(conn, organization_id, module_id)
            actor = await _manager_course(conn, auth_id, organization_id, course_id)
            current = (await conn.execute(text("""
                SELECT status FROM app.course_modules
                WHERE organization_id=:org AND id=:module_id AND course_id=:course_id
                FOR UPDATE
            """), {"org": organization_id, "module_id": module_id,
                    "course_id": course_id})).mappings().first()
            if not current:
                raise HTTPException(status_code=404, detail="Unidad no disponible")
            if current["status"] == "published" and any(key in changes for key in ("title", "description")):
                raise HTTPException(status_code=409,
                    detail="Para modificar una unidad publicada, pásala primero a borrador")
            item = (await conn.execute(text(f"""
                UPDATE app.course_modules SET {assignments}
                WHERE organization_id=:org AND id=:module_id AND course_id=:course_id
                RETURNING id::text AS id, title, description, position, status
            """), {"org": organization_id, "course_id": course_id,
                    "module_id": module_id, **changes})).mappings().first()
            if not item:
                raise HTTPException(status_code=404, detail="Unidad no disponible")
            await _audit(conn, organization_id, actor, "update", "course_modules", module_id)
        return dict(item)
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


@router.post("/{organization_id}/course-modules/{module_id}/lessons", status_code=status.HTTP_201_CREATED)
async def create_lesson(
    organization_id: UUID, module_id: UUID, payload: LessonCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """La lección pertenece siempre a una unidad del mismo tenant."""
    try:
        async with engine.begin() as conn:
            # Autorizar primero: ni siquiera se revela la existencia de una unidad.
            await _require_scope(conn, auth_id, organization_id, manage=True)
            course_id = await _course_from_module(conn, organization_id, module_id)
            actor = await _manager_course(conn, auth_id, organization_id, course_id, lock=True)
            position = (await conn.execute(text("""
                SELECT COALESCE(MAX(position),0)+1 FROM app.lessons
                WHERE organization_id=:org AND module_id=:module_id
            """), {"org": organization_id, "module_id": module_id})).scalar_one()
            item = (await conn.execute(text("""
                INSERT INTO app.lessons (organization_id,module_id,title,content,position,status)
                VALUES (:org,:module_id,:title,:content,:position,'draft')
                RETURNING id::text AS id, module_id::text AS module_id,
                          title, content, position, status
            """), {"org": organization_id, "module_id": module_id,
                    "position": position, **payload.model_dump()})).mappings().one()
            # El borrador y la lección se insertan en la misma transacción.
            await create_initial_draft(
                conn, organization_id, UUID(item["id"]), actor, "institutional",
                payload.title, payload.content,
            )
            await _audit(conn, organization_id, actor, "create", "lessons", UUID(item["id"]))
        return dict(item)
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


@router.patch("/{organization_id}/lessons/{lesson_id}")
async def update_lesson(
    organization_id: UUID, lesson_id: UUID, payload: LessonUpdate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Edita texto plano; nunca se renderiza HTML sin sanitizar."""
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Indica al menos un cambio")
    if ("title" in changes and changes["title"] is None) or ("status" in changes and changes["status"] is None):
        raise HTTPException(status_code=422, detail="Título y estado no pueden ser nulos")
    assignments = ", ".join(f"{name}=:{name}" for name in changes)
    try:
        async with engine.begin() as conn:
            # No consultar metadatos de lecciones antes de validar el rol.
            await _require_scope(conn, auth_id, organization_id, manage=True)
            course_id = await _course_from_lesson(conn, organization_id, lesson_id)
            actor = await _manager_course(conn, auth_id, organization_id, course_id, lock=True)
            current = (await conn.execute(text("""
                SELECT status, title, content FROM app.lessons
                WHERE organization_id=:org AND id=:lesson_id
                FOR UPDATE
            """), {"org": organization_id, "lesson_id": lesson_id})).mappings().first()
            if not current:
                raise HTTPException(status_code=404, detail="Lección no disponible")
            # Los formularios heredados no pueden saltarse el historial editorial.
            # La función valida transición y actualiza la revisión en la
            # misma transacción que la proyección que sigue leyendo v28.
            await sync_legacy_update(
                conn, organization_id, lesson_id, actor, "institutional",
                current["status"], current["title"], current["content"], changes,
            )
            item = (await conn.execute(text(f"""
                UPDATE app.lessons SET {assignments}
                WHERE organization_id=:org AND id=:lesson_id AND EXISTS (
                  SELECT 1 FROM app.course_modules m
                  WHERE m.organization_id=:org AND m.id=app.lessons.module_id AND m.course_id=:course_id
                ) RETURNING id::text AS id, module_id::text AS module_id,
                            title, content, position, status
            """), {"org": organization_id, "course_id": course_id,
                    "lesson_id": lesson_id, **changes})).mappings().first()
            if not item:
                raise HTTPException(status_code=404, detail="Lección no disponible")
            await _audit(conn, organization_id, actor, "update", "lessons", lesson_id)
        return dict(item)
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


async def _swap_positions(conn: AsyncConnection, org: UUID, *, table: Literal["course_modules", "lessons", "offering_modules", "offering_lessons"],
                          parent_field: Literal["course_id", "offering_id", "module_id"], parent_id: UUID,
                          record_id: UUID, direction: Literal["up", "down"]) -> bool:
    """Intercambio con posición temporal positiva: respeta UNIQUE y CHECK(position>0)."""
    # Nombres de tabla/campo sólo proceden de Literals de código, no del cliente.
    items = (await conn.execute(text(f"""
        SELECT id, position FROM app.{table}
        WHERE organization_id=:org AND {parent_field}=:parent_id
        ORDER BY position FOR UPDATE
    """), {"org": org, "parent_id": parent_id})).mappings().all()
    index = next((i for i, item in enumerate(items) if item["id"] == record_id), -1)
    if index == -1:
        raise HTTPException(status_code=404, detail="Elemento no disponible")
    other = index + (-1 if direction == "up" else 1)
    if other < 0 or other >= len(items):
        return False
    current = items[index]
    neighbor = items[other]
    temporary = max(item["position"] for item in items) + 1
    for item_id, position in (
        (current["id"], temporary),
        (neighbor["id"], current["position"]),
        (current["id"], neighbor["position"]),
    ):
        await conn.execute(text(f"""
            UPDATE app.{table} SET position=:position
            WHERE organization_id=:org AND {parent_field}=:parent_id AND id=:id
        """), {"org": org, "parent_id": parent_id, "id": item_id, "position": position})
    return True


@router.patch("/{organization_id}/courses/{course_id}/modules/{module_id}/move")
async def move_module(
    organization_id: UUID, course_id: UUID, module_id: UUID, payload: MoveDirection,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    try:
        async with engine.begin() as conn:
            actor = await _manager_course(conn, auth_id, organization_id, course_id, lock=True)
            changed = await _swap_positions(conn, organization_id, table="course_modules",
                parent_field="course_id", parent_id=course_id, record_id=module_id,
                direction=payload.direction)
            if changed:
                await _audit(conn, organization_id, actor, "reorder", "course_modules", module_id)
        return {"changed": changed}
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


@router.patch("/{organization_id}/course-modules/{module_id}/lessons/{lesson_id}/move")
async def move_lesson(
    organization_id: UUID, module_id: UUID, lesson_id: UUID, payload: MoveDirection,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    try:
        async with engine.begin() as conn:
            # Autorizar primero: ni siquiera se revela la existencia de una unidad.
            await _require_scope(conn, auth_id, organization_id, manage=True)
            course_id = await _course_from_module(conn, organization_id, module_id)
            actor = await _manager_course(conn, auth_id, organization_id, course_id, lock=True)
            changed = await _swap_positions(conn, organization_id, table="lessons",
                parent_field="module_id", parent_id=module_id, record_id=lesson_id,
                direction=payload.direction)
            if changed:
                await _audit(conn, organization_id, actor, "reorder", "lessons", lesson_id)
        return {"changed": changed}
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc
