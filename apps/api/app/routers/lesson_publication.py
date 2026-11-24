"""CAMBIOS 20 v29.3 · Publicación versionada, historial y restauración.

Las modificaciones de revisión, proyección heredada y auditoría son atómicas.
El historial y los borradores se consultan exclusivamente por docentes/gestores
mediante los permisos actuales de cada institución y oferta.
"""

import json
import logging
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.course_content import _audit
from app.routers.lesson_revisions import (
    Source,
    _authorize,
    _column,
    _document,
    _draft,
    _lesson_status,
    _table,
)
from app.services.lesson_documents import validate_document
from app.services.lesson_publication import document_to_plain_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/academic/organizations", tags=["lesson-publication"])


class PublishRequest(BaseModel):
    """Una publicación solo puede confirmar el borrador que el editor cargó."""

    model_config = ConfigDict(extra="forbid")
    expected_lock_version: int = Field(ge=1)
    # El coordinador confirma el número de ofertas afectadas observado en pantalla.
    expected_affected_offerings: int | None = Field(default=None, ge=0)


class RestoreRequest(BaseModel):
    """Restaurar nunca modifica una versión histórica: prepara otro borrador."""

    model_config = ConfigDict(extra="forbid")
    expected_published_revision_id: UUID | None = None
    # Sustitución explícita de un borrador existente; nunca silenciosa.
    replace_draft_id: UUID | None = None
    expected_draft_lock_version: int | None = Field(default=None, ge=1)


def _iso(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


async def _impact(conn: AsyncConnection, org: UUID, lesson_id: UUID) -> int:
    """Ofertas vigentes vinculadas al curso institucional de esta lección."""
    return int((await conn.execute(text("""
        SELECT count(*) FROM app.course_offerings o
        JOIN app.course_modules m ON m.organization_id=o.organization_id
            AND m.course_id=o.course_id
        JOIN app.lessons l ON l.organization_id=m.organization_id AND l.module_id=m.id
        WHERE l.organization_id=:org AND l.id=:lesson_id
          AND o.status <> 'cancelled'
    """), {"org": org, "lesson_id": lesson_id})).scalar_one())


async def _published(conn: AsyncConnection, org: UUID, lesson_id: UUID,
                     source: Source, *, lock: bool = False) -> dict | None:
    row = (await conn.execute(text(f"""
        SELECT id, revision_number, title, document_format, document_body
        FROM app.lesson_revisions
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
          AND revision_state='published'
        {"FOR UPDATE" if lock else ""}
    """), {"org": org, "lesson_id": lesson_id})).mappings().first()
    return dict(row) if row else None


async def _publish(conn: AsyncConnection, auth_id: UUID, org: UUID,
                   lesson_id: UUID, source: Source, payload: PublishRequest) -> dict:
    actor = await _authorize(conn, auth_id, org, lesson_id, source, lock=True)
    await _lesson_status(conn, org, lesson_id, source)  # FOR UPDATE de la lección
    draft = await _draft(conn, org, lesson_id, source, lock=True)
    if draft is None:
        raise HTTPException(status_code=409, detail="No existe un borrador que publicar")
    if draft["lock_version"] != payload.expected_lock_version:
        raise HTTPException(status_code=409, detail="El borrador cambió; recarga antes de publicar")

    affected = 0
    if source == "institutional":
        affected = await _impact(conn, org, lesson_id)
        if payload.expected_affected_offerings is None:
            raise HTTPException(status_code=422, detail="Confirma el impacto institucional")
        if payload.expected_affected_offerings != affected:
            raise HTTPException(status_code=409, detail="Cambió el número de ofertas; vuelve a confirmar")

    # Convertir a JSON validado incluso si la revisión se originó en texto plano.
    document = validate_document(_document(draft))
    projection = document_to_plain_text(document)
    current = await _published(conn, org, lesson_id, source, lock=True)
    next_number = int((await conn.execute(text(f"""
        SELECT COALESCE(MAX(revision_number),0)+1 FROM app.lesson_revisions
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
    """), {"org": org, "lesson_id": lesson_id})).scalar_one())

    if current is not None:
        await conn.execute(text("""
            UPDATE app.lesson_revisions SET revision_state='superseded', updated_by=:actor
            WHERE organization_id=:org AND id=:revision_id AND revision_state='published'
        """), {"org": org, "revision_id": current["id"], "actor": actor})
    await conn.execute(text("""
        UPDATE app.lesson_revisions
        SET revision_state='published', revision_number=:number,
            document_format='tiptap-json-v1', document_body=:body,
            published_by=:actor, published_at=now(), updated_by=:actor,
            lock_version=lock_version+1, origin=CASE WHEN origin='restored' THEN 'restored' ELSE origin END
        WHERE organization_id=:org AND id=:revision_id AND revision_state='draft'
    """), {
        "org": org, "revision_id": draft["id"], "number": next_number,
        "body": json.dumps(document, ensure_ascii=False, separators=(",", ":")),
        "actor": actor,
    })
    # Único punto de actualización del contenido publicado heredado.
    await conn.execute(text(f"""
        UPDATE {_table(source)} SET title=:title, content=:content, status='published'
        WHERE organization_id=:org AND id=:lesson_id
    """), {"org": org, "lesson_id": lesson_id, "title": draft["title"], "content": projection})
    await _audit(conn, org, actor, "publish_revision", "lesson_revisions", draft["id"])
    return {"revision_id": str(draft["id"]), "revision_number": next_number,
            "revision_state": "published", "affected_offerings": affected}


async def _history(conn: AsyncConnection, auth_id: UUID, org: UUID,
                   lesson_id: UUID, source: Source, offset: int, limit: int) -> dict:
    await _authorize(conn, auth_id, org, lesson_id, source)
    count = int((await conn.execute(text(f"""
        SELECT count(*) FROM app.lesson_revisions
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
          AND revision_state <> 'draft'
    """), {"org": org, "lesson_id": lesson_id})).scalar_one())
    rows = (await conn.execute(text(f"""
        SELECT r.id, r.revision_number, r.revision_state, r.title, r.origin,
               r.published_at, r.created_at, r.published_by,
               COALESCE(u.full_name, '—') AS published_by_name
        FROM app.lesson_revisions r
        LEFT JOIN app.users u ON u.id=r.published_by
        WHERE r.organization_id=:org AND r.{_column(source)}=:lesson_id
          AND r.revision_state <> 'draft'
        ORDER BY r.revision_number DESC NULLS LAST, r.created_at DESC
        LIMIT :limit OFFSET :offset
    """), {"org": org, "lesson_id": lesson_id, "limit": limit, "offset": offset})).mappings().all()
    return {"total": count, "items": [
        {**{key: str(value) if isinstance(value, UUID) else value
             for key, value in dict(row).items() if key not in ("published_at", "created_at")},
         "published_at": _iso(row["published_at"]), "created_at": _iso(row["created_at"])}
        for row in rows
    ]}


async def _revision_detail(conn: AsyncConnection, auth_id: UUID, org: UUID,
                           lesson_id: UUID, source: Source, revision_id: UUID) -> dict:
    await _authorize(conn, auth_id, org, lesson_id, source)
    row = (await conn.execute(text(f"""
        SELECT r.id, r.title, r.revision_number, r.revision_state,
               r.document_body, r.document_format, r.published_at
        FROM app.lesson_revisions r
        WHERE r.organization_id=:org AND r.{_column(source)}=:lesson_id AND r.id=:revision_id
          AND r.revision_state <> 'draft'
    """), {"org": org, "lesson_id": lesson_id, "revision_id": revision_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Versión histórica no disponible")
    return {"id": str(row["id"]), "title": row["title"],
            "revision_number": row["revision_number"], "revision_state": row["revision_state"],
            "published_at": _iso(row["published_at"]), "document": _document(dict(row))}


async def _restore(conn: AsyncConnection, auth_id: UUID, org: UUID,
                   lesson_id: UUID, source: Source, revision_id: UUID,
                   payload: RestoreRequest) -> dict:
    actor = await _authorize(conn, auth_id, org, lesson_id, source, lock=True)
    await _lesson_status(conn, org, lesson_id, source)
    draft = await _draft(conn, org, lesson_id, source, lock=True)
    if draft is not None:
        if (payload.replace_draft_id != draft["id"] or
                payload.expected_draft_lock_version != draft["lock_version"]):
            raise HTTPException(status_code=409, detail="El borrador cambió; confirma su sustitución")
    elif payload.replace_draft_id is not None:
        raise HTTPException(status_code=409, detail="Ya no existe el borrador anterior")
    published = await _published(conn, org, lesson_id, source)
    if (published["id"] if published else None) != payload.expected_published_revision_id:
        raise HTTPException(status_code=409, detail="La publicación cambió; recarga el historial")
    historic = (await conn.execute(text(f"""
        SELECT id, title, document_format, document_body
        FROM app.lesson_revisions
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
          AND id=:revision_id AND revision_state <> 'draft'
    """), {"org": org, "lesson_id": lesson_id, "revision_id": revision_id})).mappings().first()
    if historic is None:
        raise HTTPException(status_code=404, detail="Versión histórica no disponible")
    document = _document(dict(historic))
    if draft is not None:
        # La sustitución se hace únicamente tras confirmación y con control
        # optimista. Sus asociaciones se retiran, pero nunca se borran bytes.
        await conn.execute(text("""
            DELETE FROM app.lesson_revision_resources
            WHERE organization_id=:org AND lesson_revision_id=:draft_id
        """), {"org": org, "draft_id": draft["id"]})
        await conn.execute(text("""
            DELETE FROM app.lesson_revisions
            WHERE organization_id=:org AND id=:draft_id
              AND revision_state='draft' AND lock_version=:expected
        """), {"org": org, "draft_id": draft["id"],
               "expected": draft["lock_version"]})
    # Copiar asociaciones de recursos, pero jamás reescribir el objeto anterior.
    new = (await conn.execute(text(f"""
        INSERT INTO app.lesson_revisions (
          organization_id, {_column(source)}, base_revision_id, title,
          revision_state, document_format, document_body, origin, created_by, updated_by
        ) VALUES (:org, :lesson_id, :base_id, :title, 'draft', 'tiptap-json-v1',
                  :body, 'restored', :actor, :actor)
        RETURNING id
    """), {"org": org, "lesson_id": lesson_id, "base_id": historic["id"],
            "title": historic["title"], "body": json.dumps(document, ensure_ascii=False),
            "actor": actor})).mappings().one()
    await conn.execute(text("""
        INSERT INTO app.lesson_revision_resources
          (organization_id, lesson_revision_id, resource_kind, file_id, external_url,
           title, position, added_by)
        SELECT organization_id, :target, resource_kind, file_id, external_url,
               title, position, :actor
        FROM app.lesson_revision_resources
        WHERE organization_id=:org AND lesson_revision_id=:origin
    """), {"org": org, "origin": historic["id"], "target": new["id"], "actor": actor})
    await _audit(conn, org, actor, "restore_revision_draft", "lesson_revisions", new["id"])
    return {"draft_id": str(new["id"]), "restored_from": str(historic["id"])}


def _db_error(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Error PostgreSQL en publicación de lección")
    if isinstance(exc, IntegrityError):
        return HTTPException(status_code=409, detail="La revisión cambió durante la operación")
    return HTTPException(status_code=503, detail="No se pudo completar la operación editorial")


async def _handle(action: Literal["publish", "history", "revision", "restore", "impact"],
                  source: Source, org: UUID, lesson_id: UUID, auth_id: UUID,
                  engine: AsyncEngine, *, publish: PublishRequest | None = None,
                  restore: RestoreRequest | None = None, revision_id: UUID | None = None,
                  offset: int = 0, limit: int = 20) -> dict:
    try:
        async with engine.begin() as conn:
            if action == "publish":
                assert publish is not None
                return await _publish(conn, auth_id, org, lesson_id, source, publish)
            if action == "history":
                return await _history(conn, auth_id, org, lesson_id, source, offset, limit)
            if action == "impact":
                await _authorize(conn, auth_id, org, lesson_id, source)
                return {"affected_offerings": await _impact(conn, org, lesson_id) if source == "institutional" else 0}
            if action == "revision":
                assert revision_id is not None
                return await _revision_detail(conn, auth_id, org, lesson_id, source, revision_id)
            assert revision_id is not None and restore is not None
            return await _restore(conn, auth_id, org, lesson_id, source, revision_id, restore)
    except SQLAlchemyError as exc:
        raise _db_error(exc) from exc


# Rutas públicas del controlador: todos los UUID quedan ligados a organización.
@router.get("/{organization_id}/lessons/{lesson_id}/history")
async def institutional_history(organization_id: UUID, lesson_id: UUID,
    offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=50),
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("history", "institutional", organization_id, lesson_id, auth_id, engine,
                         offset=offset, limit=limit)


@router.get("/{organization_id}/offering-lessons/{lesson_id}/history")
async def offering_history(organization_id: UUID, lesson_id: UUID,
    offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=50),
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("history", "offering", organization_id, lesson_id, auth_id, engine,
                         offset=offset, limit=limit)


@router.get("/{organization_id}/lessons/{lesson_id}/impact")
async def institutional_impact(organization_id: UUID, lesson_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("impact", "institutional", organization_id, lesson_id, auth_id, engine)


@router.get("/{organization_id}/offering-lessons/{lesson_id}/impact")
async def offering_impact(organization_id: UUID, lesson_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("impact", "offering", organization_id, lesson_id, auth_id, engine)


@router.post("/{organization_id}/lessons/{lesson_id}/publish")
async def publish_institutional(organization_id: UUID, lesson_id: UUID, payload: PublishRequest,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("publish", "institutional", organization_id, lesson_id, auth_id, engine,
                         publish=payload)


@router.post("/{organization_id}/offering-lessons/{lesson_id}/publish")
async def publish_offering(organization_id: UUID, lesson_id: UUID, payload: PublishRequest,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("publish", "offering", organization_id, lesson_id, auth_id, engine,
                         publish=payload)


@router.get("/{organization_id}/lessons/{lesson_id}/revisions/{revision_id}")
async def institutional_revision(organization_id: UUID, lesson_id: UUID, revision_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("revision", "institutional", organization_id, lesson_id, auth_id, engine,
                         revision_id=revision_id)


@router.get("/{organization_id}/offering-lessons/{lesson_id}/revisions/{revision_id}")
async def offering_revision(organization_id: UUID, lesson_id: UUID, revision_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("revision", "offering", organization_id, lesson_id, auth_id, engine,
                         revision_id=revision_id)


@router.post("/{organization_id}/lessons/{lesson_id}/revisions/{revision_id}/restore", status_code=status.HTTP_201_CREATED)
async def institutional_restore(organization_id: UUID, lesson_id: UUID, revision_id: UUID, payload: RestoreRequest,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("restore", "institutional", organization_id, lesson_id, auth_id, engine,
                         revision_id=revision_id, restore=payload)


@router.post("/{organization_id}/offering-lessons/{lesson_id}/revisions/{revision_id}/restore", status_code=status.HTTP_201_CREATED)
async def offering_restore(organization_id: UUID, lesson_id: UUID, revision_id: UUID, payload: RestoreRequest,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _handle("restore", "offering", organization_id, lesson_id, auth_id, engine,
                         revision_id=revision_id, restore=payload)
