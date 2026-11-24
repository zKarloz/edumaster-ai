"""Lectura de la revisión PUBLICADA desde una oferta académica (v29.3).

Ninguna ruta de este controlador consulta ni devuelve borradores. El usuario
ha de ser gestor, docente asignado o estudiante matriculado en la oferta.
"""

import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic_activity import ASSIGNED_INSTRUCTOR, _actor_scope
from app.routers.course_content import _manager_course
from app.routers.lesson_resources import _signed_download
from app.routers.lesson_revisions import _document

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/academic/organizations", tags=["published-lessons"])
PublishedSource = Literal["base", "offering"]


async def _allowed_revision(conn: AsyncConnection, auth_id: UUID, org: UUID,
                            offering_id: UUID, lesson_id: UUID,
                            source: PublishedSource) -> dict:
    """Impide suplantación de oferta para leer una lección de otro curso."""
    scope = await _actor_scope(conn, auth_id, org)
    access = (await conn.execute(text(f"""
        SELECT off.course_id, off.status AS offering_status,
               c.status AS course_status, {ASSIGNED_INSTRUCTOR} AS assigned,
               EXISTS (
                 SELECT 1 FROM app.enrollments e
                 JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
                   AND s.status='active'
                 JOIN app.organization_memberships m ON m.id=s.membership_id
                   AND m.organization_id=s.organization_id AND m.status='active'
                 WHERE e.organization_id=off.organization_id AND e.offering_id=off.id
                   AND e.status IN ('active','completed') AND m.user_id=:actor
               ) AS enrolled
        FROM app.course_offerings off
        JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
        WHERE off.organization_id=:org AND off.id=:offering_id AND off.status<>'cancelled'
    """), {"org": org, "offering_id": offering_id,
           "actor": scope["actor_id"]})).mappings().first()
    if not access:
        raise HTTPException(status_code=404, detail="Oferta académica no disponible")
    editor = bool(scope["is_manager"] or access["assigned"])
    if not editor and not access["enrolled"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado a la oferta")
    if not editor and access["course_status"] != "published":
        raise HTTPException(status_code=404, detail="Curso no publicado")

    if source == "base":
        row = (await conn.execute(text("""
            SELECT r.id, r.title, r.revision_number, r.document_format, r.document_body
            FROM app.lessons l
            JOIN app.course_modules m ON m.id=l.module_id AND m.organization_id=l.organization_id
            JOIN app.lesson_revisions r ON r.organization_id=l.organization_id
                AND r.institutional_lesson_id=l.id AND r.revision_state='published'
            WHERE l.organization_id=:org AND l.id=:lesson_id
                AND m.course_id=:course_id
                AND l.status='published' AND m.status='published'
        """), {"org": org, "lesson_id": lesson_id,
               "course_id": access["course_id"]})).mappings().first()
    else:
        row = (await conn.execute(text("""
            SELECT r.id, r.title, r.revision_number, r.document_format, r.document_body
            FROM app.offering_lessons l
            JOIN app.offering_modules m ON m.id=l.module_id AND m.organization_id=l.organization_id
            JOIN app.lesson_revisions r ON r.organization_id=l.organization_id
                AND r.offering_lesson_id=l.id AND r.revision_state='published'
            WHERE l.organization_id=:org AND l.id=:lesson_id
                AND m.offering_id=:offering_id
                AND l.status='published' AND m.status='published'
        """), {"org": org, "lesson_id": lesson_id,
               "offering_id": offering_id})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Lección publicada no disponible")
    return dict(row)


async def _resources(conn: AsyncConnection, org: UUID, revision_id: UUID) -> list[dict]:
    rows = (await conn.execute(text("""
        SELECT r.id, r.resource_kind AS kind, r.title, r.external_url AS url,
               r.position, f.original_filename AS filename, f.media_type, f.size_bytes
        FROM app.lesson_revision_resources r
        LEFT JOIN app.resource_files f ON f.organization_id=r.organization_id AND f.id=r.file_id
        WHERE r.organization_id=:org AND r.lesson_revision_id=:revision_id
        ORDER BY r.position LIMIT 200
    """), {"org": org, "revision_id": revision_id})).mappings().all()
    return [dict(row) | {"id": str(row["id"])} for row in rows]


async def _read(org: UUID, offering_id: UUID, source: PublishedSource,
                lesson_id: UUID, auth_id: UUID, engine: AsyncEngine) -> dict:
    try:
        async with engine.connect() as conn:
            row = await _allowed_revision(conn, auth_id, org, offering_id, lesson_id, source)
            resources = await _resources(conn, org, row["id"])
        return {"title": row["title"], "revision_number": row["revision_number"],
                "document": _document(row), "resources": resources}
    except SQLAlchemyError as exc:
        logger.exception("Error leyendo revisión pública")
        raise HTTPException(status_code=503, detail="No se pudo consultar la lección") from exc


async def _download(org: UUID, offering_id: UUID, source: PublishedSource,
                    lesson_id: UUID, resource_id: UUID, auth_id: UUID,
                    engine: AsyncEngine) -> dict:
    try:
        async with engine.connect() as conn:
            row = await _allowed_revision(conn, auth_id, org, offering_id, lesson_id, source)
            file = (await conn.execute(text("""
                SELECT f.object_path FROM app.lesson_revision_resources r
                JOIN app.resource_files f ON f.organization_id=r.organization_id AND f.id=r.file_id
                WHERE r.organization_id=:org AND r.lesson_revision_id=:revision_id
                  AND r.id=:resource_id AND r.resource_kind='file'
            """), {"org": org, "revision_id": row["id"],
                   "resource_id": resource_id})).mappings().first()
        if file is None:
            raise HTTPException(status_code=404, detail="Archivo publicado no disponible")
        return {"url": await _signed_download(file["object_path"]), "expires_in": 60}
    except SQLAlchemyError as exc:
        logger.exception("Error autorizando recurso publicado")
        raise HTTPException(status_code=503, detail="No se pudo autorizar la descarga") from exc


async def _allowed_base_revision(conn: AsyncConnection, auth_id: UUID, org: UUID,
                                 course_id: UUID, lesson_id: UUID) -> dict:
    """Vista administrativa del curso institucional, sin matrícula artificial."""
    await _manager_course(conn, auth_id, org, course_id)
    row = (await conn.execute(text("""
        SELECT r.id, r.title, r.revision_number, r.document_format, r.document_body
        FROM app.lessons l
        JOIN app.course_modules m ON m.id=l.module_id AND m.organization_id=l.organization_id
        JOIN app.lesson_revisions r ON r.organization_id=l.organization_id
          AND r.institutional_lesson_id=l.id AND r.revision_state='published'
        WHERE l.organization_id=:org AND l.id=:lesson_id AND m.course_id=:course_id
          AND l.status='published' AND m.status='published'
    """), {"org": org, "course_id": course_id, "lesson_id": lesson_id})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Lección institucional publicada no disponible")
    return dict(row)


@router.get("/{organization_id}/courses/{course_id}/published-lessons/{lesson_id}")
async def base_course_published_lesson(organization_id: UUID, course_id: UUID,
    lesson_id: UUID, auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.connect() as conn:
            row = await _allowed_base_revision(conn, auth_id, organization_id, course_id, lesson_id)
            resources = await _resources(conn, organization_id, row["id"])
        return {"title": row["title"], "revision_number": row["revision_number"],
                "document": _document(row), "resources": resources}
    except SQLAlchemyError as exc:
        logger.exception("Error consultando lección de curso base")
        raise HTTPException(status_code=503, detail="No se pudo consultar la lección") from exc


@router.get("/{organization_id}/courses/{course_id}/published-lessons/{lesson_id}/resources/{resource_id}/download")
async def base_course_published_resource(organization_id: UUID, course_id: UUID,
    lesson_id: UUID, resource_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.connect() as conn:
            row = await _allowed_base_revision(conn, auth_id, organization_id, course_id, lesson_id)
            file = (await conn.execute(text("""
                SELECT f.object_path FROM app.lesson_revision_resources r
                JOIN app.resource_files f ON f.organization_id=r.organization_id AND f.id=r.file_id
                WHERE r.organization_id=:org AND r.lesson_revision_id=:revision_id
                  AND r.id=:resource_id AND r.resource_kind='file'
            """), {"org": organization_id, "revision_id": row["id"],
                   "resource_id": resource_id})).mappings().first()
        if file is None:
            raise HTTPException(status_code=404, detail="Archivo institucional no disponible")
        return {"url": await _signed_download(file["object_path"]), "expires_in": 60}
    except SQLAlchemyError as exc:
        logger.exception("Error autorizando recurso institucional publicado")
        raise HTTPException(status_code=503, detail="No se pudo autorizar la descarga") from exc


@router.get("/{organization_id}/course-offerings/{offering_id}/published-lessons/{source}/{lesson_id}")
async def published_lesson(organization_id: UUID, offering_id: UUID,
    source: PublishedSource, lesson_id: UUID, auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _read(organization_id, offering_id, source, lesson_id, auth_id, engine)


@router.get("/{organization_id}/course-offerings/{offering_id}/published-lessons/{source}/{lesson_id}/resources/{resource_id}/download")
async def published_resource_download(organization_id: UUID, offering_id: UUID,
    source: PublishedSource, lesson_id: UUID, resource_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _download(organization_id, offering_id, source, lesson_id, resource_id, auth_id, engine)
