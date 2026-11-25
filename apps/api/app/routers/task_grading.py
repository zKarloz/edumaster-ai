"""CAMBIOS 22 v30.3 · Rúbricas y notas oficiales de entregas.

Toda operación valida institución, oferta, docente/matrícula y entrega en SQL.
Una sola nota por tarea/matrícula alimenta el promedio académico; rectificaciones
conservan el registro académico y una instantánea auditable de la nota anterior.
"""

import json
import logging
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic_activity import _audit
from app.routers.course_tasks import _context, _editor, _task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/academic/organizations", tags=["task-grading"])


class RubricCriterionIn(BaseModel):
    """Los puntos por criterio expresan la ponderación dentro de la tarea."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    max_points: Decimal = Field(gt=0, le=100, max_digits=7, decimal_places=2)


class RubricInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[RubricCriterionIn] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_total(self):
        titles = [item.title.casefold() for item in self.items]
        if len(set(titles)) != len(titles):
            raise ValueError("Los nombres de criterios no pueden repetirse")
        if sum((item.max_points for item in self.items), Decimal(0)) > 100:
            raise ValueError("El total de la rúbrica no puede superar 100 puntos")
        return self


class CriterionScoreIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    criterion_id: UUID
    points: Decimal = Field(ge=0, max_digits=7, decimal_places=2)
    comment: str = Field(default="", max_length=500)


class OfficialGradeIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    criteria: list[CriterionScoreIn] = Field(min_length=1, max_length=10)
    feedback: str = Field(default="", max_length=3000)
    expected_revision: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def no_duplicate_criteria(self):
        ids = [item.criterion_id for item in self.criteria]
        if len(ids) != len(set(ids)):
            raise ValueError("Los criterios de la calificación no pueden repetirse")
        return self


def _score_rubric(criteria: list[dict], scores: list[CriterionScoreIn]) -> tuple[Decimal, Decimal, list[dict]]:
    """Valida el desglose contra la rúbrica guardada, nunca contra máximos del cliente."""
    if not criteria:
        raise HTTPException(status_code=409, detail="Configura una rúbrica antes de calificar")
    lookup = {str(row["id"]): row for row in criteria}
    submitted = {str(item.criterion_id): item for item in scores}
    if set(lookup) != set(submitted):
        raise HTTPException(status_code=422, detail="La nota debe incluir cada criterio de la rúbrica")
    points = Decimal(0)
    maximum = Decimal(0)
    snapshot: list[dict] = []
    for row in criteria:
        key = str(row["id"])
        item = submitted[key]
        cap = Decimal(str(row["max_points"]))
        if item.points > cap:
            raise HTTPException(status_code=422, detail=f"Puntaje fuera del máximo en {row['title']}")
        points += item.points
        maximum += cap
        snapshot.append({"criterion_id": key, "title": row["title"],
                         "points": str(item.points), "max_points": str(cap),
                         "comment": item.comment})
    return points, maximum, snapshot


async def _criteria(conn: AsyncConnection, org: UUID, task_id: UUID) -> list[dict]:
    rows = (await conn.execute(text("""
        SELECT id,position,title,description,max_points
        FROM app.task_rubric_criteria
        WHERE organization_id=:org AND task_id=:task_id
        ORDER BY position
    """), {"org": org, "task_id": task_id})).mappings().all()
    return [dict(row) for row in rows]


async def _grade(conn: AsyncConnection, org: UUID, task_id: UUID, enrollment_id: UUID,
                 *, lock: bool = False) -> dict | None:
    row = (await conn.execute(text(f"""
        SELECT id,submission_id,academic_record_id,score,max_score,criteria_scores,
               feedback,revision,graded_at
        FROM app.task_official_grades
        WHERE organization_id=:org AND task_id=:task_id AND enrollment_id=:enrollment_id
        {"FOR UPDATE" if lock else ""}
    """), {"org": org, "task_id": task_id, "enrollment_id": enrollment_id})).mappings().first()
    return dict(row) if row else None


def _public_grade(grade: dict | None) -> dict | None:
    if not grade:
        return None
    snapshot = grade["criteria_scores"]
    # Dependiendo del codec JSONB de asyncpg, puede venir como lista o texto.
    if isinstance(snapshot, str):
        snapshot = json.loads(snapshot)
    return {"id": str(grade["id"]), "submission_id": str(grade["submission_id"]),
            "score": grade["score"], "max_score": grade["max_score"],
            "criteria": snapshot, "feedback": grade["feedback"],
            "revision": grade["revision"], "graded_at": grade["graded_at"]}


def _db_failure(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Error SQL de rúbricas/calificaciones")
    return HTTPException(status_code=503, detail="No se pudo operar la calificación; verifica la migración 013")


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/rubric")
async def get_rubric(
    organization_id: UUID, offering_id: UUID, task_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """La rúbrica publicada es visible solo a matriculados y docentes autorizados."""
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            task = await _task(conn, organization_id, offering_id, task_id)
            if not ctx["editor"] and task["status"] == "draft":
                raise HTTPException(status_code=404, detail="Rúbrica no publicada")
            criteria = await _criteria(conn, organization_id, task_id)
            locked = bool((await conn.execute(text("""
                SELECT 1 FROM app.task_official_grades
                WHERE organization_id=:org AND task_id=:task_id LIMIT 1
            """), {"org": organization_id, "task_id": task_id})).first())
        return {"items": [{**r, "id": str(r["id"])} for r in criteria],
                "total_points": sum((r["max_points"] for r in criteria), Decimal(0)),
                "can_edit": bool(ctx["editor"] and not locked),
                "locked": locked if ctx["editor"] else False}
    except SQLAlchemyError as exc:
        raise _db_failure(exc) from exc


@router.put("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/rubric")
async def save_rubric(
    organization_id: UUID, offering_id: UUID, task_id: UUID, payload: RubricInput,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Permite adaptar tareas existentes solo hasta su primera nota oficial."""
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            await _task(conn, organization_id, offering_id, task_id, lock=True)
            if (await conn.execute(text("""
                SELECT 1 FROM app.task_official_grades
                WHERE organization_id=:org AND task_id=:task_id LIMIT 1
            """), {"org": organization_id, "task_id": task_id})).first():
                raise HTTPException(status_code=409, detail="No se modifica una rúbrica con notas oficiales")
            await conn.execute(text("""
                DELETE FROM app.task_rubric_criteria
                WHERE organization_id=:org AND task_id=:task_id
            """), {"org": organization_id, "task_id": task_id})
            for position, criterion in enumerate(payload.items, start=1):
                await conn.execute(text("""
                    INSERT INTO app.task_rubric_criteria
                      (organization_id,offering_id,task_id,position,title,description,max_points)
                    VALUES (:org,:offering_id,:task_id,:position,:title,:description,:max_points)
                """), {"org": organization_id, "offering_id": offering_id,
                       "task_id": task_id, "position": position, **criterion.model_dump()})
            await _audit(conn, organization_id, ctx["actor"], "rubric.update", "course_tasks", task_id)
        return {"ok": True}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Conflicto al guardar la rúbrica") from exc
    except SQLAlchemyError as exc:
        raise _db_failure(exc) from exc


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/my-grade")
async def my_task_grade(
    organization_id: UUID, offering_id: UUID, task_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Solo consulta la matrícula propia; ningún ID de estudiante viene de la URL."""
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            if ctx["editor"]:
                raise HTTPException(status_code=403, detail="Vista exclusiva del estudiante")
            task = await _task(conn, organization_id, offering_id, task_id)
            if task["status"] == "draft":
                raise HTTPException(status_code=404, detail="Tarea no publicada")
            grade = await _grade(conn, organization_id, task_id, ctx["enrollment_id"])
        return {"grade": _public_grade(grade)}
    except SQLAlchemyError as exc:
        raise _db_failure(exc) from exc


@router.get("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions/{submission_id}/grade")
async def get_submission_grade(
    organization_id: UUID, offering_id: UUID, task_id: UUID, submission_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Devuelve exclusivamente nota y desglose de una entrega dentro de esta oferta."""
    try:
        async with engine.connect() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            await _task(conn, organization_id, offering_id, task_id)
            row = (await conn.execute(text("""
                SELECT enrollment_id FROM app.task_submissions
                WHERE organization_id=:org AND offering_id=:offering_id
                  AND task_id=:task_id AND id=:submission_id
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "submission_id": submission_id})).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Entrega no disponible")
            grade = await _grade(conn, organization_id, task_id, row["enrollment_id"])
        return {"grade": _public_grade(grade) if grade and grade["submission_id"] == submission_id else None}
    except SQLAlchemyError as exc:
        raise _db_failure(exc) from exc


@router.put("/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}/submissions/{submission_id}/grade")
async def put_submission_grade(
    organization_id: UUID, offering_id: UUID, task_id: UUID, submission_id: UUID,
    payload: OfficialGradeIn,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Emite/rectifica la nota oficial y el promedio en UNA transacción.

    El cierre de la tarea congela nuevos intentos. Solo puede calificarse el
    último intento revisado, para que no haya dos notas oficiales por estudiante.
    expected_revision=0 significa primera emisión; otros valores evitan pisar cambios.
    """
    try:
        async with engine.begin() as conn:
            ctx = await _context(conn, auth_id, organization_id, offering_id)
            _editor(ctx)
            task = await _task(conn, organization_id, offering_id, task_id, lock=True)
            if task["status"] != "closed":
                raise HTTPException(status_code=409, detail="Cierra la tarea antes de emitir notas oficiales")
            submission = (await conn.execute(text("""
                SELECT id,enrollment_id,status,attempt_number
                FROM app.task_submissions
                WHERE organization_id=:org AND offering_id=:offering_id
                  AND task_id=:task_id AND id=:submission_id
                FOR UPDATE
            """), {"org": organization_id, "offering_id": offering_id,
                   "task_id": task_id, "submission_id": submission_id})).mappings().first()
            if not submission:
                raise HTTPException(status_code=404, detail="Entrega no disponible")
            if submission["status"] != "reviewed":
                raise HTTPException(status_code=409, detail="Primero guarda las observaciones de la revisión")
            if (await conn.execute(text("""
                SELECT 1 FROM app.task_submissions
                WHERE organization_id=:org AND task_id=:task_id AND enrollment_id=:enrollment_id
                  AND attempt_number>:attempt_number LIMIT 1
            """), {"org": organization_id, "task_id": task_id,
                   "enrollment_id": submission["enrollment_id"],
                   "attempt_number": submission["attempt_number"]})).first():
                raise HTTPException(status_code=409, detail="Califica el último intento del estudiante")
            criteria = await _criteria(conn, organization_id, task_id)
            score, maximum, snapshot = _score_rubric(criteria, payload.criteria)
            grade = await _grade(conn, organization_id, task_id, submission["enrollment_id"], lock=True)
            if (grade["revision"] if grade else 0) != payload.expected_revision:
                raise HTTPException(status_code=409, detail="La nota cambió. Recarga antes de rectificar")
            params = {"org": organization_id, "offering_id": offering_id, "task_id": task_id,
                      "enrollment_id": submission["enrollment_id"], "submission_id": submission_id,
                      "score": score, "max_score": maximum, "feedback": payload.feedback,
                      "criteria_scores": json.dumps(snapshot, ensure_ascii=False), "actor": ctx["actor"],
                      "title": f"Tarea: {task['title']}"[:120]}
            if grade:
                if grade["submission_id"] != submission_id:
                    raise HTTPException(status_code=409, detail="La nota pertenece a otro intento")
                await conn.execute(text("""
                    INSERT INTO app.task_official_grade_history
                      (organization_id,grade_id,revision,previous_score,
                       previous_max_score,previous_criteria_scores,previous_feedback,changed_by)
                    VALUES (:org,:grade_id,:revision,:previous_score,:previous_max_score,
                            CAST(:previous_criteria_scores AS jsonb),:previous_feedback,:actor)
                """), {"org": organization_id, "grade_id": grade["id"],
                       "revision": grade["revision"], "previous_score": grade["score"],
                       "previous_max_score": grade["max_score"],
                       "previous_criteria_scores": json.dumps(json.loads(grade["criteria_scores"]) if isinstance(grade["criteria_scores"], str)
                                                         else grade["criteria_scores"], ensure_ascii=False),
                       "previous_feedback": grade["feedback"], "actor": ctx["actor"]})
                await conn.execute(text("""
                    UPDATE app.task_official_grades SET score=:score,max_score=:max_score,
                        criteria_scores=CAST(:criteria_scores AS jsonb),feedback=:feedback,
                        revision=revision+1,graded_at=now(),graded_by=:actor
                    WHERE organization_id=:org AND id=:grade_id
                """), {**params, "grade_id": grade["id"]})
                academic_record_id = grade["academic_record_id"]
                revision = grade["revision"] + 1
                action = "grade.correct"
            else:
                academic_record_id = (await conn.execute(text("""
                    INSERT INTO app.academic_activity_records
                      (organization_id,enrollment_id,kind,title,activity_date,
                       score,max_score,recorded_by,notes)
                    VALUES (:org,:enrollment_id,'grade',:title,current_date,
                            :score,:max_score,:actor,left(:feedback,500))
                    RETURNING id
                """), params)).scalar_one()
                await conn.execute(text("""
                    INSERT INTO app.task_official_grades
                      (organization_id,offering_id,task_id,enrollment_id,submission_id,
                       academic_record_id,score,max_score,criteria_scores,feedback,graded_by)
                    VALUES (:org,:offering_id,:task_id,:enrollment_id,:submission_id,
                            :academic_record_id,:score,:max_score,
                            CAST(:criteria_scores AS jsonb),:feedback,:actor)
                """), {**params, "academic_record_id": academic_record_id})
                revision = 1
                action = "grade.issue"
            if grade:
                updated = (await conn.execute(text("""
                    UPDATE app.academic_activity_records
                    SET score=:score,max_score=:max_score,notes=left(:feedback,500),
                        recorded_at=now(),recorded_by=:actor
                    WHERE organization_id=:org AND enrollment_id=:enrollment_id
                      AND id=:academic_record_id AND kind='grade' AND voided_at IS NULL
                    RETURNING id
                """), {**params, "academic_record_id": academic_record_id})).first()
                if not updated:
                    raise HTTPException(status_code=409, detail="La nota académica fue anulada")
            await _audit(conn, organization_id, ctx["actor"], action,
                         "academic_activity_records", academic_record_id)
        return {"ok": True, "revision": revision, "score": score, "max_score": maximum}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Conflicto de nota; recarga la entrega") from exc
    except SQLAlchemyError as exc:
        raise _db_failure(exc) from exc
