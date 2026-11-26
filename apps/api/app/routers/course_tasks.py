"""CAMBIOS 21 · v30.2: tareas por oferta y entregas con adjuntos privados.

El rol global no concede acceso: siempre se comprueban organización, oferta y
matrícula. Las notas oficiales continúan en el módulo académico, sin mezclarlas
con las revisiones de texto de esta etapa.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic_activity import ASSIGNED_INSTRUCTOR, _actor_scope, _audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/academic/organizations", tags=["course-tasks"])


class TaskInput(BaseModel):
    """Campos de una tarea; la fecha debe venir con zona horaria explícita."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=3, max_length=180)
    instructions: str = Field(min_length=10, max_length=10000)
    due_at: datetime | None = None
    max_attempts: int = Field(default=1, ge=1, le=10)

    @field_validator("due_at")
    @classmethod
    def ensure_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("La fecha límite debe incluir zona horaria")
        return value


class AnswerInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    # La respuesta puede contener solo archivos. Se valida que exista texto o adjuntos.
    answer_text: str = Field(default="", max_length=10000)


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    review_notes: str = Field(min_length=2, max_length=3000)


async def _context(conn: AsyncConnection, auth_id: UUID, org: UUID, offering_id: UUID) -> dict:
    """Unifica rol y matrícula verificados, sin confiar en IDs del navegador."""
    scope = await _actor_scope(conn, auth_id, org)
    row = (await conn.execute(text(f"""
        SELECT off.id, off.status AS offering_status, c.status AS course_status,
               {ASSIGNED_INSTRUCTOR} AS assigned,
               (SELECT e.id FROM app.enrollments e
                 JOIN app.students s ON s.organization_id=e.organization_id AND s.id=e.student_id
                 JOIN app.organization_memberships m ON m.organization_id=s.organization_id
                   AND m.id=s.membership_id AND m.status='active'
                 WHERE e.organization_id=off.organization_id AND e.offering_id=off.id
                   AND s.status='active' AND m.user_id=:actor
                   AND e.status IN ('active','completed') LIMIT 1) AS enrollment_id,
               (SELECT e.status FROM app.enrollments e
                 JOIN app.students s ON s.organization_id=e.organization_id AND s.id=e.student_id
                 JOIN app.organization_memberships m ON m.organization_id=s.organization_id
                   AND m.id=s.membership_id AND m.status='active'
                 WHERE e.organization_id=off.organization_id AND e.offering_id=off.id
                   AND s.status='active' AND m.user_id=:actor
                   AND e.status IN ('active','completed') LIMIT 1) AS enrollment_status
        FROM app.course_offerings off
        JOIN app.courses c ON c.organization_id=off.organization_id AND c.id=off.course_id
        WHERE off.organization_id=:org AND off.id=:offering_id AND off.status<>'cancelled'
    """), {"org": org, "offering_id": offering_id, "actor": scope["actor_id"]})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Oferta académica no disponible")
    editor = bool(scope["is_manager"] or row["assigned"])
    if not editor and not row["enrollment_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso a esta oferta")
    if not editor and row["course_status"] != "published":
        raise HTTPException(status_code=404, detail="Curso no publicado")
    return dict(row) | {"editor": editor, "actor": scope["actor_id"]}


def _editor(ctx: dict) -> None:
    if not ctx["editor"]:
        raise HTTPException(status_code=403, detail="Solo gestores y docentes asignados")


def _student(ctx: dict) -> UUID:
    if not ctx["enrollment_id"]:
        raise HTTPException(status_code=403, detail="Requiere matrícula en la oferta")
    return ctx["enrollment_id"]


def _can_submit(ctx: dict, task: dict) -> None:
    _student(ctx)
    if ctx["enrollment_status"] != "active":
        raise HTTPException(status_code=409, detail="La matrícula no está activa")
    if ctx["offering_status"] != "open" or ctx["course_status"] != "published":
        raise HTTPException(status_code=409, detail="La oferta no admite entregas ahora")
    if task["status"] != "published":
        raise HTTPException(status_code=409, detail="La tarea no admite entregas")
    due = task["due_at"]
    if due is not None and datetime.now(UTC) > due:
        raise HTTPException(status_code=409, detail="La fecha de entrega ya venció")


async def _task(conn: AsyncConnection, org: UUID, offering_id: UUID, task_id: UUID,
                *, lock: bool = False) -> dict:
    row = (await conn.execute(text(f"""
        SELECT id, title, instructions, due_at, max_attempts, status, published_at
        FROM app.course_tasks
        WHERE organization_id=:org AND offering_id=:offering_id AND id=:task_id
        {"FOR UPDATE" if lock else ""}
    """), {"org": org, "offering_id": offering_id, "task_id": task_id})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Tarea no disponible")
    return dict(row)


def _public_task(task: dict) -> dict:
    """Serializa los UUID de las tareas, sin datos de una matrícula ajena."""
    return {**task, "id": str(task["id"])}


def _sql_error(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Error SQL de tareas académicas")
    return HTTPException(status_code=503, detail="No se pudo operar la tarea; verifica migración 011")


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks")
async def list_tasks(organization_id: UUID, offering_id: UUID,
                     auth_id: UUID = Depends(authenticated_user_id),
                     engine: AsyncEngine = Depends(require_engine)) -> dict:
    """El estudiante ve solo tareas públicas y el resumen de sus propios intentos."""
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            rows = (await conn.execute(text("""
                SELECT t.id, t.title, t.instructions, t.due_at, t.max_attempts,
                       t.status, t.published_at,
                       (SELECT count(*) FROM app.task_submissions s
                         WHERE s.organization_id=t.organization_id AND s.task_id=t.id
                           AND s.enrollment_id=:enrollment_id) AS my_attempts,
                       (SELECT count(*) FROM app.task_submissions s
                         WHERE s.organization_id=t.organization_id AND s.task_id=t.id) AS total_submissions
                FROM app.course_tasks t
                WHERE t.organization_id=:org AND t.offering_id=:offering_id
                  AND (:editor OR t.status IN ('published','closed'))
                ORDER BY t.created_at DESC LIMIT 200
            """), {"org": organization_id, "offering_id": offering_id,
                   "editor": ctx["editor"], "enrollment_id": ctx["enrollment_id"]})).mappings().all()
        return {"role": "editor" if ctx["editor"] else "student",
                "can_submit": bool(ctx["enrollment_status"] == "active" and
                                   ctx["offering_status"] == "open" and ctx["course_status"] == "published"),
                "items": [{**_public_task(dict(row)),
                           "total_submissions": row["total_submissions"] if ctx["editor"] else None} for row in rows]}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.post("/{organization_id}/course-offerings/{offering_id}/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(organization_id: UUID, offering_id: UUID, payload: TaskInput,
                      auth_id: UUID = Depends(authenticated_user_id),
                      engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            if ctx["course_status"] == "archived":
                raise HTTPException(status_code=409, detail="No se crean tareas para cursos archivados")
            row = (await conn.execute(text("""
                INSERT INTO app.course_tasks
                  (organization_id,offering_id,title,instructions,due_at,max_attempts,created_by)
                VALUES (:org,:offering_id,:title,:instructions,:due_at,:max_attempts,:actor)
                RETURNING id, title, instructions, due_at, max_attempts, status, published_at
            """), {"org": organization_id, "offering_id": offering_id,
                   "title": payload.title, "instructions": payload.instructions,
                   "due_at": payload.due_at, "max_attempts": payload.max_attempts,
                   "actor": ctx["actor"]})).mappings().one()
            await _audit(conn, organization_id, ctx["actor"], "task.create", "course_tasks", row["id"])
        return _public_task(dict(row))
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.patch("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}")
async def update_task(organization_id: UUID, offering_id: UUID, task_id: UUID,
                      payload: TaskInput, auth_id: UUID = Depends(authenticated_user_id),
                      engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            task = await _task(conn, organization_id, offering_id, task_id, lock=True)
            if task["status"] != "draft":
                raise HTTPException(status_code=409, detail="Solo se editan tareas en borrador")
            await conn.execute(text("""
                UPDATE app.course_tasks SET title=:title, instructions=:instructions,
                    due_at=:due_at, max_attempts=:max_attempts, updated_at=now()
                WHERE organization_id=:org AND offering_id=:offering_id AND id=:task_id
            """), {"org": organization_id, "offering_id": offering_id, "task_id": task_id,
                   "title": payload.title, "instructions": payload.instructions,
                   "due_at": payload.due_at, "max_attempts": payload.max_attempts})
            await _audit(conn, organization_id, ctx["actor"], "task.edit", "course_tasks", task_id)
        return {"ok": True}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.post("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/publish")
async def publish_task(organization_id: UUID, offering_id: UUID, task_id: UUID,
                       auth_id: UUID = Depends(authenticated_user_id),
                       engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            if ctx["course_status"] == "archived":
                raise HTTPException(status_code=409, detail="Curso archivado")
            task = await _task(conn, organization_id, offering_id, task_id, lock=True)
            if task["status"] != "draft":
                raise HTTPException(status_code=409, detail="La tarea no está en borrador")
            await conn.execute(text("""
                UPDATE app.course_tasks SET status='published', published_at=now(), published_by=:actor, updated_at=now()
                WHERE organization_id=:org AND offering_id=:offering_id AND id=:task_id
            """), {"org": organization_id, "offering_id": offering_id, "task_id": task_id,
                   "actor": ctx["actor"]})
            await _audit(conn, organization_id, ctx["actor"], "task.publish", "course_tasks", task_id)
        return {"ok": True, "status": "published"}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.post("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/close")
async def close_task(organization_id: UUID, offering_id: UUID, task_id: UUID,
                     auth_id: UUID = Depends(authenticated_user_id),
                     engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            task = await _task(conn, organization_id, offering_id, task_id, lock=True)
            if task["status"] != "published":
                raise HTTPException(status_code=409, detail="Solo se cierra una tarea publicada")
            await conn.execute(text("""
                UPDATE app.course_tasks SET status='closed',updated_at=now()
                WHERE organization_id=:org AND offering_id=:offering_id AND id=:task_id
            """), {"org": organization_id, "offering_id": offering_id, "task_id": task_id})
            await _audit(conn, organization_id, ctx["actor"], "task.close", "course_tasks", task_id)
        return {"ok": True, "status": "closed"}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/my-submissions")
async def my_submissions(organization_id: UUID, offering_id: UUID, task_id: UUID,
                         auth_id: UUID = Depends(authenticated_user_id),
                         engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            enrollment_id = _student(ctx)
            task = await _task(conn, organization_id, offering_id, task_id)
            if task["status"] == "draft":
                raise HTTPException(status_code=404, detail="Tarea no publicada")
            rows = (await conn.execute(text("""
                SELECT id, attempt_number, answer_text, submitted_at, status,
                       review_notes, reviewed_at
                FROM app.task_submissions
                WHERE organization_id=:org AND offering_id=:offering_id AND task_id=:task_id
                  AND enrollment_id=:enrollment_id ORDER BY attempt_number DESC LIMIT 10
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "enrollment_id": enrollment_id})).mappings().all()
        return {"items": [{**dict(row), "id": str(row["id"])} for row in rows]}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.post("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions", status_code=status.HTTP_201_CREATED)
async def submit_task(organization_id: UUID, offering_id: UUID, task_id: UUID,
                      payload: AnswerInput, auth_id: UUID = Depends(authenticated_user_id),
                      engine: AsyncEngine = Depends(require_engine)) -> dict:
    """Bloquea tarea y matrícula para serializar intentos concurrentes."""
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            enrollment_id = _student(ctx)
            task = await _task(conn, organization_id, offering_id, task_id, lock=True)
            _can_submit(ctx, task)
            enrollment = (await conn.execute(text("""
                SELECT id FROM app.enrollments WHERE organization_id=:org
                  AND offering_id=:offering_id AND id=:enrollment_id AND status='active'
                FOR UPDATE
            """), {"org": organization_id, "offering_id": offering_id,
                   "enrollment_id": enrollment_id})).mappings().first()
            if enrollment is None:
                raise HTTPException(status_code=409, detail="La matrícula cambió de estado")
            count = int((await conn.execute(text("""
                SELECT count(*) FROM app.task_submissions
                WHERE organization_id=:org AND task_id=:task_id AND enrollment_id=:enrollment_id
            """), {"org": organization_id, "task_id": task_id,
                   "enrollment_id": enrollment_id})).scalar_one())
            if count >= task["max_attempts"]:
                raise HTTPException(status_code=409, detail="Se agotaron los intentos permitidos")
            # Los archivos pendientes son del actor/matrícula, no IDs del cliente.
            # Esta lectura está serializada por el bloqueo de la matrícula.
            pending = int((await conn.execute(text("""
                SELECT count(*) FROM app.task_submission_files
                WHERE organization_id=:org AND offering_id=:offering_id
                  AND task_id=:task_id AND enrollment_id=:enrollment_id
                  AND submission_id IS NULL
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "enrollment_id": enrollment_id})).scalar_one())
            if not payload.answer_text.strip() and pending == 0:
                raise HTTPException(status_code=422, detail="Escribe una respuesta o adjunta un archivo")
            if pending > 3:
                raise HTTPException(status_code=409, detail="Demasiados adjuntos pendientes")
            # Validación en el reloj de PostgreSQL para evitar rebasar el plazo
            # entre la comprobación Python y el INSERT.
            row = (await conn.execute(text("""
                INSERT INTO app.task_submissions
                  (organization_id,offering_id,task_id,enrollment_id,attempt_number,answer_text)
                SELECT :org,:offering_id,:task_id,:enrollment_id,:attempt_number,:answer_text
                WHERE EXISTS (
                  SELECT 1 FROM app.course_tasks t
                  WHERE t.organization_id=:org AND t.offering_id=:offering_id AND t.id=:task_id
                    AND t.status='published' AND (t.due_at IS NULL OR clock_timestamp()<=t.due_at)
                )
                RETURNING id, attempt_number, submitted_at, status
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "enrollment_id": enrollment_id,
                   "attempt_number": count + 1, "answer_text": payload.answer_text})).mappings().first()
            if row is None:
                raise HTTPException(status_code=409, detail="Venció el plazo de entrega")
            # La asociación a este intento es atómica con el INSERT. Si hay
            # rollback, los archivos permanecen pendientes para reintentar.
            await conn.execute(text("""
                UPDATE app.task_submission_files SET submission_id=:submission_id
                WHERE organization_id=:org AND offering_id=:offering_id
                  AND task_id=:task_id AND enrollment_id=:enrollment_id
                  AND submission_id IS NULL
            """), {"submission_id": row["id"], "org": organization_id,
                   "offering_id": offering_id, "task_id": task_id,
                   "enrollment_id": enrollment_id})
            await _audit(conn, organization_id, ctx["actor"], "task.submit", "task_submissions", row["id"])
        return {**dict(row), "id": str(row["id"]), "attachment_count": pending}
    except IntegrityError as exc:
        logger.info("Intento concurrente o matrícula/tarea incompatible")
        raise HTTPException(status_code=409, detail="La entrega entró en conflicto; recarga la tarea") from exc
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions")
async def task_submissions(organization_id: UUID, offering_id: UUID, task_id: UUID,
                           limit: int = Query(default=10, ge=1, le=50),
                           offset: int = Query(default=0, ge=0),
                           auth_id: UUID = Depends(authenticated_user_id),
                           engine: AsyncEngine = Depends(require_engine)) -> dict:
    """Docentes reciben solo una página de entregas, no todo el grupo."""
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            await _task(conn, organization_id, offering_id, task_id)
            params = {"org": organization_id, "offering_id": offering_id,
                      "task_id": task_id, "limit": limit, "offset": offset}
            total = int((await conn.execute(text("""
                SELECT count(*) FROM app.task_submissions
                WHERE organization_id=:org AND offering_id=:offering_id AND task_id=:task_id
            """), params)).scalar_one())
            rows = (await conn.execute(text("""
                SELECT s.id, s.attempt_number, s.answer_text, s.status,
                       s.submitted_at, s.review_notes, s.reviewed_at,
                       g.score AS official_score, g.max_score AS official_max_score,
                       NOT EXISTS (
                         SELECT 1 FROM app.task_submissions newer
                         WHERE newer.organization_id=s.organization_id
                           AND newer.task_id=s.task_id AND newer.enrollment_id=s.enrollment_id
                           AND newer.attempt_number>s.attempt_number
                       ) AS is_latest_attempt,
                       u.full_name AS student_name
                FROM app.task_submissions s
                LEFT JOIN app.task_official_grades g ON g.organization_id=s.organization_id
                  AND g.task_id=s.task_id AND g.submission_id=s.id
                JOIN app.enrollments e ON e.organization_id=s.organization_id
                  AND e.id=s.enrollment_id AND e.offering_id=s.offering_id
                JOIN app.students st ON st.organization_id=e.organization_id AND st.id=e.student_id
                JOIN app.organization_memberships m ON m.organization_id=st.organization_id
                  AND m.id=st.membership_id
                JOIN app.users u ON u.id=m.user_id
                WHERE s.organization_id=:org AND s.offering_id=:offering_id AND s.task_id=:task_id
                ORDER BY s.submitted_at DESC, s.id LIMIT :limit OFFSET :offset
            """), params)).mappings().all()
        return {"total": total, "items": [{**dict(row), "id": str(row["id"])} for row in rows]}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions/{submission_id}")
async def get_submission_for_review(
    organization_id: UUID, offering_id: UUID, task_id: UUID, submission_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Consulta individual para una página enlazable. No permite lectura de otros alumnos.

    La pertenencia a institución/oferta y el rol docente se validan ANTES
    de recuperar el texto o datos personales de la entrega.
    """
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            task = await _task(conn, organization_id, offering_id, task_id)
            row = (await conn.execute(text("""
                SELECT s.id, s.attempt_number, s.answer_text, s.status,
                       s.submitted_at, s.review_notes, s.reviewed_at,
                       NOT EXISTS (
                         SELECT 1 FROM app.task_submissions newer
                         WHERE newer.organization_id=s.organization_id
                           AND newer.task_id=s.task_id AND newer.enrollment_id=s.enrollment_id
                           AND newer.attempt_number>s.attempt_number
                       ) AS is_latest_attempt,
                       u.full_name AS student_name
                FROM app.task_submissions s
                JOIN app.enrollments e ON e.organization_id=s.organization_id
                  AND e.id=s.enrollment_id AND e.offering_id=s.offering_id
                JOIN app.students st ON st.organization_id=e.organization_id
                  AND st.id=e.student_id
                JOIN app.organization_memberships m ON m.organization_id=st.organization_id
                  AND m.id=st.membership_id
                JOIN app.users u ON u.id=m.user_id
                WHERE s.organization_id=:org AND s.offering_id=:offering_id
                  AND s.task_id=:task_id AND s.id=:submission_id
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "submission_id": submission_id})).mappings().first()
            if row is None:
                raise HTTPException(status_code=404, detail="Entrega no disponible")
        return {"task": _public_task(task),
                "submission": {**dict(row), "id": str(row["id"])}}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc


@router.post("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions/{submission_id}/review")
async def review_submission(organization_id: UUID, offering_id: UUID, task_id: UUID,
                            submission_id: UUID, payload: ReviewInput,
                            auth_id: UUID = Depends(authenticated_user_id),
                            engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            await _task(conn, organization_id, offering_id, task_id)
            row = (await conn.execute(text("""
                UPDATE app.task_submissions SET status='reviewed', review_notes=:notes,
                    reviewed_at=now(), reviewed_by=:actor
                WHERE organization_id=:org AND offering_id=:offering_id AND task_id=:task_id
                  AND id=:submission_id AND status='submitted'
                RETURNING id
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "submission_id": submission_id,
                   "notes": payload.review_notes, "actor": ctx["actor"]})).mappings().first()
            if row is None:
                raise HTTPException(status_code=409, detail="Entrega ya revisada o no disponible")
            await _audit(conn, organization_id, ctx["actor"], "task.review", "task_submissions", submission_id)
        return {"ok": True, "status": "reviewed"}
    except SQLAlchemyError as exc:
        raise _sql_error(exc) from exc
