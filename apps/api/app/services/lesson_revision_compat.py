"""Puente transaccional entre las lecciones v28 y las revisiones v29.1.

Toda llamada usa la misma conexión y transacción que modifica la lección.
El contenido publicado de la tabla antigua no cambia mientras exista un
borrador independiente. No habilita publicar documentos Tiptap (v29.3).
"""

from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

Source = Literal["institutional", "offering"]


def _column(source: Source) -> str:
    """Los identificadores SQL proceden de constantes, nunca del cliente."""
    return "institutional_lesson_id" if source == "institutional" else "offering_lesson_id"


async def create_initial_draft(
    conn: AsyncConnection, org: UUID, lesson_id: UUID, actor: UUID,
    source: Source, title: str, content: str | None,
) -> None:
    """Crea el borrador legado junto con la lección recién insertada."""
    await conn.execute(text(f"""
        INSERT INTO app.lesson_revisions (
            organization_id, {_column(source)}, revision_state, document_format,
            document_body, legacy_content_was_null, title, origin, created_by, updated_by
        ) VALUES (
            :org, :lesson_id, 'draft', 'plain-text-v1', :body, :was_null,
            :title, 'editor', :actor, :actor
        )
    """), {
        "org": org, "lesson_id": lesson_id, "body": content or "",
        "was_null": content is None, "title": title, "actor": actor,
    })


async def _active_revision(
    conn: AsyncConnection, org: UUID, lesson_id: UUID, source: Source,
    state: Literal["draft", "published"],
) -> dict | None:
    """La lección debe estar bloqueada por el llamador antes de consultar."""
    row = (await conn.execute(text(f"""
        SELECT id, title, document_body, document_format, lock_version,
               revision_number, base_revision_id, legacy_content_was_null
        FROM app.lesson_revisions
        WHERE organization_id=:org AND {_column(source)}=:lesson_id
          AND revision_state=:state
        FOR UPDATE
    """), {"org": org, "lesson_id": lesson_id, "state": state})).mappings().first()
    return dict(row) if row else None


async def _create_reopened_draft(
    conn: AsyncConnection, org: UUID, lesson_id: UUID, source: Source,
    actor: UUID, title: str, content: str | None,
) -> None:
    """Recupera una archivada SIN sobrescribir revisiones históricas."""
    current = await _active_revision(conn, org, lesson_id, source, "published")
    await conn.execute(text(f"""
        INSERT INTO app.lesson_revisions (
            organization_id, {_column(source)}, base_revision_id,
            revision_state, document_format, document_body,
            legacy_content_was_null, title, origin, created_by, updated_by
        ) VALUES (
            :org, :lesson_id, :base_id, 'draft', 'plain-text-v1',
            :body, :was_null, :title, 'editor', :actor, :actor
        )
    """), {
        "org": org, "lesson_id": lesson_id, "base_id": current["id"] if current else None,
        "body": content or "", "was_null": content is None,
        "title": title, "actor": actor,
    })


async def sync_legacy_update(
    conn: AsyncConnection, org: UUID, lesson_id: UUID, actor: UUID,
    source: Source, current_status: str, current_title: str,
    current_content: str | None, changes: dict,
) -> None:
    """Valida una escritura antigua y sincroniza las revisiones ANTES del PATCH.

    La lección está bloqueada con FOR UPDATE; al fallar cualquiera de estas
    operaciones, la transacción revierte sin modificar la proyección v28.
    """
    new_status = changes.get("status", current_status)
    edited = "title" in changes or "content" in changes
    if current_status == "published":
        if edited or new_status == "draft":
            raise HTTPException(
                status_code=409,
                detail="La lección está publicada. Crea una revisión en borrador para editarla",
            )
        # Al archivar, la revisión publicada sigue conservada, pero el workspace
        # la ocultará por el estado de la lección original.
        return

    if current_status == "archived" and edited:
        raise HTTPException(status_code=409, detail="Primero reactiva la lección como borrador")

    draft = await _active_revision(conn, org, lesson_id, source, "draft")
    published = None
    if current_status == "archived":
        published = await _active_revision(conn, org, lesson_id, source, "published")
        if new_status == "published":
            # Desarchivar una publicación ya existente no crea otra versión.
            if not published or draft:
                raise HTTPException(status_code=409, detail="Primero prepara un borrador de revisión")
            return
        if new_status == "draft" and not draft:
            await _create_reopened_draft(
                conn, org, lesson_id, source, actor, current_title, current_content,
            )
        return

    if draft is None:
        raise HTTPException(status_code=503, detail="Falta la revisión de borrador de esta lección")
    if edited and draft["document_format"] != "plain-text-v1":
        raise HTTPException(
            status_code=409,
            detail="Este borrador se edita en el editor enriquecido; recarga antes de modificarlo",
        )
    if new_status == "published":
        if draft["document_format"] != "plain-text-v1":
            raise HTTPException(status_code=409, detail="La publicación enriquecida estará disponible próximamente")
        published = await _active_revision(conn, org, lesson_id, source, "published")
        if published:
            raise HTTPException(status_code=409, detail="Ya existe una versión publicada; utiliza el editor")

    if edited:
        await conn.execute(text(f"""
            UPDATE app.lesson_revisions
            SET title=:title, document_body=:body, legacy_content_was_null=:was_null,
                updated_by=:actor, lock_version=lock_version + :increment
            WHERE organization_id=:org AND {_column(source)}=:lesson_id
              AND id=:draft_id AND revision_state='draft'
        """), {
            "org": org, "lesson_id": lesson_id, "draft_id": draft["id"],
            "actor": actor, "increment": 0 if new_status == "published" else 1,
            "title": changes.get("title", current_title),
            "body": (changes.get("content", current_content) or ""),
            "was_null": changes.get("content", current_content) is None,
        })

    if new_status == "published":
        # Se admite la publicación PLANA heredada para no romper v28.
        # Una revisión Tiptap solo podrá publicarse en el flujo versionado.
        next_number = (await conn.execute(text(f"""
            SELECT COALESCE(MAX(revision_number), 0) + 1
            FROM app.lesson_revisions
            WHERE organization_id=:org AND {_column(source)}=:lesson_id
        """), {"org": org, "lesson_id": lesson_id})).scalar_one()
        await conn.execute(text(f"""
            UPDATE app.lesson_revisions
            SET revision_state='published', revision_number=:number,
                published_by=:actor, published_at=now(), updated_by=:actor,
                lock_version=lock_version+1
            WHERE organization_id=:org AND {_column(source)}=:lesson_id
              AND id=:draft_id AND revision_state='draft'
        """), {
            "org": org, "lesson_id": lesson_id, "draft_id": draft["id"],
            "actor": actor, "number": next_number,
        })
