"""CAMBIOS 20 · Endpoints de borradores de revisiones v29.1.

El flujo heredado sincroniza revisiones y proyección en una misma transacción.
Nunca se entregan borradores a estudiantes ni se actualizan los registros
visibles de las lecciones desde estos endpoints.
"""

import json
import logging
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic import _require_scope
from app.routers.academic_activity import _actor_scope
from app.routers.course_content import (
    _audit,
    _course_from_lesson,
    _manager_course,
)
from app.routers.offering_content import _editor, _offering_from_lesson
from app.services.lesson_documents import (
    DocumentValidationError,
    DraftSave,
    plain_text_to_document,
    validate_document,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/academic/organizations", tags=["lesson-revisions"])
Source = Literal["institutional", "offering"]


def _column(source: Source) -> str:
    """Evita construir nombres SQL a partir de entradas del cliente."""
    return "institutional_lesson_id" if source == "institutional" else "offering_lesson_id"


def _table(source: Source) -> str:
    return "app.lessons" if source == "institutional" else "app.offering_lessons"


async def _authorize(
    conn: AsyncConnection, auth_id: UUID, org: UUID, lesson_id: UUID,
    source: Source, *, lock: bool = False,
) -> UUID:
    """Verifica pertenencia y función antes de exponer una revisión privada."""
    if source == "institutional":
        await _require_scope(conn, auth_id, org, manage=True)
        course_id = await _course_from_lesson(conn, org, lesson_id)
        return await _manager_course(conn, auth_id, org, course_id, lock=lock)
    # Primero verificar que se pertenece a la institución; de otro modo ni
    # siquiera se consulta la existencia de la lección en una oferta.
    await _actor_scope(conn, auth_id, org)
    offering_id = await _offering_from_lesson(conn, org, lesson_id)
    return await _editor(conn, auth_id, org, offering_id, lock=lock)


async def _lesson_status(conn: AsyncConnection, org: UUID, lesson_id: UUID,
                         source: Source) -> str:
    """Bloquea la lección, serializando edición nueva y compatibilidad heredada."""
    current = (await conn.execute(text(f"""
        SELECT status FROM {_table(source)}
        WHERE organization_id=:org AND id=:lesson_id FOR UPDATE
    """), {"org": org, "lesson_id": lesson_id})).mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="Lección no disponible")
    if current["status"] == "archived":
        raise HTTPException(status_code=409, detail="La lección archivada no puede editarse")
    return current["status"]


def _document(row: dict) -> dict:
    """No modifica las revisiones heredadas al convertirlas para el editor."""
    try:
        if row["document_format"] == "plain-text-v1":
            return plain_text_to_document(row["document_body"])
        if row["document_format"] == "tiptap-json-v1":
            return validate_document(json.loads(row["document_body"]))
    except (ValueError, TypeError, json.JSONDecodeError, DocumentValidationError) as exc:
        logger.error("Documento académico guardado inválido: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Documento editorial no disponible") from exc
    raise HTTPException(status_code=503, detail="Formato editorial no compatible")


def _response(row: dict, source: Source, lesson_id: UUID) -> dict:
    updated = row["updated_at"]
    if isinstance(updated, datetime):
        updated = updated.isoformat()
    return {
        "id": str(row["id"]), "lesson_id": str(lesson_id), "source": source,
        "revision_state": "draft", "title": row["title"],
        "document_format": "tiptap-json-v1", "document": _document(row),
        "lock_version": row["lock_version"],
        "base_revision_id": str(row["base_revision_id"]) if row["base_revision_id"] else None,
        "updated_at": updated,
    }


async def _draft(conn: AsyncConnection, org: UUID, lesson_id: UUID,
                 source: Source, *, lock: bool = False) -> dict | None:
    row = (await conn.execute(text(f"""
        SELECT id, title, document_format, document_body, lock_version,
               base_revision_id, updated_at
        FROM app.lesson_revisions
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
          AND revision_state='draft'
        {"FOR UPDATE" if lock else ""}
    """), {"org": org, "lesson_id": lesson_id})).mappings().first()
    return dict(row) if row else None


async def _get(conn: AsyncConnection, auth_id: UUID, org: UUID,
               lesson_id: UUID, source: Source) -> dict:
    await _authorize(conn, auth_id, org, lesson_id, source)
    draft = await _draft(conn, org, lesson_id, source)
    if draft is None:
        raise HTTPException(status_code=404, detail="Esta lección no tiene borrador")
    return _response(draft, source, lesson_id)


async def _create(conn: AsyncConnection, auth_id: UUID, org: UUID,
                  lesson_id: UUID, source: Source) -> dict:
    actor = await _authorize(conn, auth_id, org, lesson_id, source, lock=True)
    state = await _lesson_status(conn, org, lesson_id, source)
    if await _draft(conn, org, lesson_id, source):
        raise HTTPException(status_code=409, detail="La lección ya tiene un borrador")
    if state != "published":
        raise HTTPException(status_code=409, detail="La lección no tiene publicación de origen")
    published = (await conn.execute(text(f"""
        SELECT id, title, document_format, document_body
        FROM app.lesson_revisions
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
          AND revision_state='published'
    """), {"org": org, "lesson_id": lesson_id})).mappings().first()
    if not published:
        raise HTTPException(status_code=503, detail="Falta la revisión publicada de origen")
    document = _document(dict(published))
    row = (await conn.execute(text(f"""
        INSERT INTO app.lesson_revisions (
          organization_id, {_column(source)}, base_revision_id,
          revision_state, document_format, document_body, title,
          created_by, updated_by, origin
        ) VALUES (
          :org, :lesson_id, :base_id, 'draft', 'tiptap-json-v1', :body,
          :title, :actor, :actor, 'editor'
        ) RETURNING id, title, document_format, document_body,
                    lock_version, base_revision_id, updated_at
    """), {
        "org": org, "lesson_id": lesson_id, "base_id": published["id"],
        "body": json.dumps(document, ensure_ascii=False, separators=(",", ":")),
        "title": published["title"], "actor": actor,
    })).mappings().one()
    # Un nuevo borrador hereda las asociaciones PUBLICADAS, sin duplicar
    # los objetos privados. Quitarlas del borrador no borra el historial.
    await conn.execute(text('''
        INSERT INTO app.lesson_revision_resources (
          organization_id, lesson_revision_id, resource_kind, file_id,
          external_url, title, position, added_by
        )
        SELECT organization_id, :draft_id, resource_kind, file_id,
               external_url, title, position, :actor
        FROM app.lesson_revision_resources
        WHERE organization_id=:org AND lesson_revision_id=:published_id
    '''), {"org": org, "draft_id": row["id"],
           "published_id": published["id"], "actor": actor})
    await _audit(conn, org, actor, "create_draft", "lesson_revisions", row["id"])
    return _response(dict(row), source, lesson_id)


async def _save(conn: AsyncConnection, auth_id: UUID, org: UUID,
                lesson_id: UUID, source: Source, payload: DraftSave) -> dict:
    actor = await _authorize(conn, auth_id, org, lesson_id, source, lock=True)
    await _lesson_status(conn, org, lesson_id, source)
    draft = await _draft(conn, org, lesson_id, source, lock=True)
    if draft is None:
        raise HTTPException(status_code=404, detail="Esta lección no tiene borrador")
    if draft["lock_version"] != payload.expected_lock_version:
        raise HTTPException(status_code=409, detail="El borrador cambió; recarga antes de guardar")
    row = (await conn.execute(text(f"""
        UPDATE app.lesson_revisions
        SET title=:title, document_body=:body, document_format='tiptap-json-v1',
            lock_version=lock_version+1, updated_by=:actor, origin='editor'
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
          AND id=:revision_id AND revision_state='draft'
          AND lock_version=:expected
        RETURNING id, title, document_format, document_body, lock_version,
                  base_revision_id, updated_at
    """), {
        "org": org, "lesson_id": lesson_id, "revision_id": draft["id"],
        "title": payload.title, "body": json.dumps(payload.document, ensure_ascii=False, separators=(",", ":")),
        "actor": actor, "expected": payload.expected_lock_version,
    })).mappings().first()
    if row is None:
        raise HTTPException(status_code=409, detail="El borrador cambió; recarga antes de guardar")
    await _audit(conn, org, actor, "save_draft", "lesson_revisions", row["id"])
    return _response(dict(row), source, lesson_id)


def _database_failure(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Fallo SQL gestionando borrador de lección")
    if isinstance(exc, IntegrityError):
        return HTTPException(status_code=409, detail="Revisión concurrente o estado incompatible")
    return HTTPException(status_code=503, detail="No se pudo consultar el borrador")


async def _handle(action: Literal["get", "create", "save"], source: Source,
                  org: UUID, lesson_id: UUID, auth_id: UUID,
                  engine: AsyncEngine, payload: DraftSave | None = None) -> dict:
    try:
        async with engine.begin() as conn:
            if action == "get":
                return await _get(conn, auth_id, org, lesson_id, source)
            if action == "create":
                return await _create(conn, auth_id, org, lesson_id, source)
            if payload is None:
                raise HTTPException(status_code=422, detail="Falta documento")
            return await _save(conn, auth_id, org, lesson_id, source, payload)
    except SQLAlchemyError as exc:
        raise _database_failure(exc) from exc


@router.get("/{organization_id}/lessons/{lesson_id}/draft")
async def get_institutional_draft(organization_id: UUID, lesson_id: UUID,
                                  auth_id: UUID = Depends(authenticated_user_id),
                                  engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("get", "institutional", organization_id, lesson_id, auth_id, engine)


@router.post("/{organization_id}/lessons/{lesson_id}/draft", status_code=status.HTTP_201_CREATED)
async def create_institutional_draft(organization_id: UUID, lesson_id: UUID,
                                     auth_id: UUID = Depends(authenticated_user_id),
                                     engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("create", "institutional", organization_id, lesson_id, auth_id, engine)


@router.patch("/{organization_id}/lessons/{lesson_id}/draft")
async def save_institutional_draft(organization_id: UUID, lesson_id: UUID, payload: DraftSave,
                                   auth_id: UUID = Depends(authenticated_user_id),
                                   engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("save", "institutional", organization_id, lesson_id, auth_id, engine, payload)


@router.get("/{organization_id}/offering-lessons/{lesson_id}/draft")
async def get_offering_draft(organization_id: UUID, lesson_id: UUID,
                             auth_id: UUID = Depends(authenticated_user_id),
                             engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("get", "offering", organization_id, lesson_id, auth_id, engine)


@router.post("/{organization_id}/offering-lessons/{lesson_id}/draft", status_code=status.HTTP_201_CREATED)
async def create_offering_draft(organization_id: UUID, lesson_id: UUID,
                                auth_id: UUID = Depends(authenticated_user_id),
                                engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("create", "offering", organization_id, lesson_id, auth_id, engine)


@router.patch("/{organization_id}/offering-lessons/{lesson_id}/draft")
async def save_offering_draft(organization_id: UUID, lesson_id: UUID, payload: DraftSave,
                              auth_id: UUID = Depends(authenticated_user_id),
                              engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("save", "offering", organization_id, lesson_id, auth_id, engine, payload)
