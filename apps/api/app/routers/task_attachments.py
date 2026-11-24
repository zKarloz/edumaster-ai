"""CAMBIOS 21 · v30.2: adjuntos privados para intentos de tareas.

Los archivos se cargan como *pendientes* por matrícula y tarea. La ruta de
entrega vincula todos los pendientes al nuevo intento dentro de la misma
transacción que registra la respuesta. El navegador nunca recibe la clave
administrativa de Supabase Storage.
"""

import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic_activity import _audit
from app.routers.course_tasks import _can_submit, _context, _student, _task
from app.routers.lesson_resources import (
    BUCKET,
    _remove_orphan,
    _signed_download,
    _upload_object,
)
from app.services.course_resources import MAX_RESOURCE_BYTES, validate_upload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/academic/organizations", tags=["task-attachments"])
MAX_FILES_PER_ATTEMPT = 3


def _attachment_public(row: dict) -> dict:
    """Expone metadatos seguros; nunca retorna ruta privada ni credenciales."""
    return {
        "id": str(row["id"]),
        "filename": row["original_filename"],
        "media_type": row["media_type"],
        "size_bytes": row["size_bytes"],
    }


async def _stage_policy(
    conn: AsyncConnection, auth_id: UUID, org: UUID, offering_id: UUID,
    task_id: UUID, *, lock: bool = False,
) -> tuple[UUID, UUID]:
    """Comprueba actor, estado, intentos y cuota; bloquea durante el INSERT."""
    ctx = await _context(conn, auth_id, org, offering_id)
    enrollment_id = _student(ctx)
    task = await _task(conn, org, offering_id, task_id, lock=lock)
    _can_submit(ctx, task)
    if lock:
        enrollment = (await conn.execute(text("""
            SELECT id FROM app.enrollments
            WHERE organization_id=:org AND offering_id=:offering_id
              AND id=:enrollment_id AND status='active' FOR UPDATE
        """), {"org": org, "offering_id": offering_id,
               "enrollment_id": enrollment_id})).mappings().first()
        if enrollment is None:
            raise HTTPException(status_code=409, detail="La matrícula cambió de estado")
    attempts = int((await conn.execute(text("""
        SELECT count(*) FROM app.task_submissions
        WHERE organization_id=:org AND task_id=:task_id AND enrollment_id=:enrollment_id
    """), {"org": org, "task_id": task_id, "enrollment_id": enrollment_id})).scalar_one())
    if attempts >= task["max_attempts"]:
        raise HTTPException(status_code=409, detail="Se agotaron los intentos permitidos")
    pending = int((await conn.execute(text("""
        SELECT count(*) FROM app.task_submission_files
        WHERE organization_id=:org AND task_id=:task_id
          AND enrollment_id=:enrollment_id AND submission_id IS NULL
    """), {"org": org, "task_id": task_id, "enrollment_id": enrollment_id})).scalar_one())
    if pending >= MAX_FILES_PER_ATTEMPT:
        raise HTTPException(status_code=409, detail="Máximo tres archivos por intento")
    return ctx["actor"], enrollment_id


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/attachments/staged")
async def staged_attachments(
    organization_id: UUID, offering_id: UUID, task_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Cada estudiante lista únicamente sus archivos pendientes de esa tarea."""
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            enrollment_id = _student(ctx)
            await _task(conn, organization_id, offering_id, task_id)
            rows = (await conn.execute(text("""
                SELECT a.id, f.original_filename, f.media_type, f.size_bytes
                FROM app.task_submission_files a
                JOIN app.resource_files f ON f.organization_id=a.organization_id AND f.id=a.file_id
                WHERE a.organization_id=:org AND a.offering_id=:offering_id
                  AND a.task_id=:task_id AND a.enrollment_id=:enrollment_id
                  AND a.submission_id IS NULL
                ORDER BY a.created_at, a.id LIMIT 3
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "enrollment_id": enrollment_id})).mappings().all()
        return {"items": [_attachment_public(dict(row)) for row in rows], "limit": MAX_FILES_PER_ATTEMPT}
    except SQLAlchemyError as exc:
        logger.exception("Error consultando archivos pendientes de tarea")
        raise HTTPException(status_code=503, detail="No se pudieron consultar los adjuntos") from exc


@router.post(
    "/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/attachments",
    status_code=status.HTTP_201_CREATED,
)
async def upload_task_attachment(
    organization_id: UUID, offering_id: UUID, task_id: UUID, request: Request,
    filename: str = Query(min_length=1, max_length=180),
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Carga limitada por streaming y reautoriza después del tráfico de red."""
    mime = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if mime not in ("application/pdf", "image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=415, detail="Solo PDF, PNG, JPG y WebP")
    try:
        async with engine.connect() as conn:
            await _stage_policy(conn, auth_id, organization_id, offering_id, task_id)
    except SQLAlchemyError as exc:
        logger.exception("Error autorizando carga de tarea")
        raise HTTPException(status_code=503, detail="No se pudo validar la tarea") from exc

    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > MAX_RESOURCE_BYTES:
            raise HTTPException(status_code=413, detail="Tamaño máximo 10 MB")
    name, extension, checksum = validate_upload(bytes(content), mime, filename)
    file_id, attachment_id = uuid4(), uuid4()
    path = f"{organization_id}/task-submissions/{task_id}/{file_id}.{extension}"
    # Evita bloquear filas PostgreSQL durante toda la transferencia a Storage.
    await _upload_object(path, bytes(content), mime)
    try:
        async with engine.begin() as conn:
            actor, enrollment_id = await _stage_policy(
                conn, auth_id, organization_id, offering_id, task_id, lock=True,
            )
            await conn.execute(text("""
                INSERT INTO app.resource_files
                  (id,organization_id,bucket,object_path,original_filename,
                   media_type,size_bytes,sha256,uploaded_by)
                VALUES (:id,:org,:bucket,:path,:name,:mime,:size,:sha,:actor)
            """), {"id": file_id, "org": organization_id, "bucket": BUCKET,
                   "path": path, "name": name, "mime": mime, "size": len(content),
                   "sha": checksum, "actor": actor})
            await conn.execute(text("""
                INSERT INTO app.task_submission_files
                  (id,organization_id,offering_id,task_id,enrollment_id,file_id)
                VALUES (:id,:org,:offering_id,:task_id,:enrollment_id,:file_id)
            """), {"id": attachment_id, "org": organization_id,
                   "offering_id": offering_id, "task_id": task_id,
                   "enrollment_id": enrollment_id, "file_id": file_id})
            await _audit(conn, organization_id, actor, "task.attachment.stage",
                         "task_submission_files", attachment_id)
    except HTTPException:
        await _remove_orphan(path)
        raise
    except IntegrityError as exc:
        await _remove_orphan(path)
        raise HTTPException(status_code=409, detail="Adjunto concurrente; recarga la tarea") from exc
    except SQLAlchemyError as exc:
        await _remove_orphan(path)
        logger.exception("No se pudo registrar el adjunto de tarea")
        raise HTTPException(status_code=503, detail="No se pudo registrar el adjunto") from exc
    return _attachment_public({"id": attachment_id, "original_filename": name,
                               "media_type": mime, "size_bytes": len(content)})


@router.delete("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/attachments/{attachment_id}")
async def discard_staged_attachment(
    organization_id: UUID, offering_id: UUID, task_id: UUID, attachment_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Solo retira archivos todavía pendientes y de la matrícula autenticada."""
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            enrollment_id = _student(ctx)
            await _task(conn, organization_id, offering_id, task_id)
            row = (await conn.execute(text("""
                SELECT a.file_id, f.object_path
                FROM app.task_submission_files a
                JOIN app.resource_files f ON f.organization_id=a.organization_id AND f.id=a.file_id
                WHERE a.id=:id AND a.organization_id=:org AND a.offering_id=:offering_id
                  AND a.task_id=:task_id AND a.enrollment_id=:enrollment_id
                  AND a.submission_id IS NULL FOR UPDATE OF a
            """), {"id": attachment_id, "org": organization_id,
                   "offering_id": offering_id, "task_id": task_id,
                   "enrollment_id": enrollment_id})).mappings().first()
            if row is None:
                raise HTTPException(status_code=404, detail="Adjunto pendiente no disponible")
            path = row["object_path"]
            await conn.execute(text("""
                DELETE FROM app.task_submission_files WHERE id=:id AND organization_id=:org
            """), {"id": attachment_id, "org": organization_id})
            await conn.execute(text("""
                DELETE FROM app.resource_files WHERE id=:id AND organization_id=:org
            """), {"id": row["file_id"], "org": organization_id})
            await _audit(conn, organization_id, ctx["actor"], "task.attachment.discard",
                         "task_submission_files", attachment_id)
    except SQLAlchemyError as exc:
        logger.exception("Error retirando adjunto pendiente")
        raise HTTPException(status_code=503, detail="No se pudo retirar el adjunto") from exc
    # La eliminación física es mejor esfuerzo; los metadatos dejan de ser accesibles.
    await _remove_orphan(path)
    return {"deleted": True}


async def _submission_policy(
    conn: AsyncConnection, auth_id: UUID, org: UUID, offering_id: UUID,
    task_id: UUID, submission_id: UUID,
) -> None:
    """Controla tanto la matrícula propietaria como al docente asignado."""
    ctx = await _context(conn, auth_id, org, offering_id)
    task = await _task(conn, org, offering_id, task_id)
    if not ctx["editor"] and task["status"] == "draft":
        raise HTTPException(status_code=404, detail="Tarea no publicada")
    exists = (await conn.execute(text("""
        SELECT id FROM app.task_submissions
        WHERE id=:submission_id AND organization_id=:org AND offering_id=:offering_id
          AND task_id=:task_id AND (:editor OR enrollment_id=:enrollment_id)
    """), {"submission_id": submission_id, "org": org,
           "offering_id": offering_id, "task_id": task_id,
           "editor": ctx["editor"], "enrollment_id": ctx["enrollment_id"]})).mappings().first()
    if exists is None:
        raise HTTPException(status_code=404, detail="Entrega no disponible")


@router.get(
    "/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions/{submission_id}/attachments",
)
async def submission_attachments(
    organization_id: UUID, offering_id: UUID, task_id: UUID, submission_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Docente y dueño de la entrega pueden listar sus adjuntos finalizados."""
    try:
        async with engine.connect() as conn:
            await _submission_policy(conn, auth_id, organization_id, offering_id,
                                     task_id, submission_id)
            rows = (await conn.execute(text("""
                SELECT a.id, f.original_filename, f.media_type, f.size_bytes
                FROM app.task_submission_files a
                JOIN app.resource_files f ON f.organization_id=a.organization_id AND f.id=a.file_id
                WHERE a.organization_id=:org AND a.offering_id=:offering_id
                  AND a.task_id=:task_id AND a.submission_id=:submission_id
                ORDER BY a.created_at, a.id LIMIT 3
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "submission_id": submission_id})).mappings().all()
        return {"items": [_attachment_public(dict(row)) for row in rows]}
    except SQLAlchemyError as exc:
        logger.exception("Error consultando adjuntos de entrega")
        raise HTTPException(status_code=503, detail="No se pudieron consultar los adjuntos") from exc


@router.get(
    "/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions/{submission_id}/attachments/{attachment_id}/download",
)
async def download_submission_attachment(
    organization_id: UUID, offering_id: UUID, task_id: UUID, submission_id: UUID,
    attachment_id: UUID, auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """URL firmada breve solo después de comprobar la relación completa."""
    try:
        async with engine.connect() as conn:
            await _submission_policy(conn, auth_id, organization_id, offering_id,
                                     task_id, submission_id)
            row = (await conn.execute(text("""
                SELECT f.object_path FROM app.task_submission_files a
                JOIN app.resource_files f ON f.organization_id=a.organization_id AND f.id=a.file_id
                WHERE a.organization_id=:org AND a.offering_id=:offering_id
                  AND a.task_id=:task_id AND a.submission_id=:submission_id AND a.id=:attachment_id
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "submission_id": submission_id,
                   "attachment_id": attachment_id})).mappings().first()
            if row is None:
                raise HTTPException(status_code=404, detail="Adjunto no disponible")
            path = row["object_path"]
        return {"url": await _signed_download(path), "expires_in": 60}
    except SQLAlchemyError as exc:
        logger.exception("Error autorizando descarga de tarea")
        raise HTTPException(status_code=503, detail="No se pudo autorizar la descarga") from exc
