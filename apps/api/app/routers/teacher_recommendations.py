"""Recomendaciones humanas privadas por oferta y matrícula autorizada."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic_activity import _audit
from app.routers.course_tasks import _context, _editor, _student

router = APIRouter(prefix="/api/v1/academic/organizations", tags=["teacher-recommendations"])
PATH = "/{organization_id}/course-offerings/{offering_id}/recommendations"


class RecommendationIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    enrollment_id: UUID
    title: str = Field(min_length=3, max_length=150)
    body: str = Field(min_length=5, max_length=3000)
    priority: Literal["normal", "high"] = "normal"


# Reutiliza las relaciones institucionales; únicamente destinatarios activos.
RECIPIENTS = """
    SELECT e.id, u.full_name FROM app.enrollments e
    JOIN app.students s ON s.organization_id=e.organization_id AND s.id=e.student_id
    JOIN app.organization_memberships m ON m.organization_id=s.organization_id AND m.id=s.membership_id
    JOIN app.users u ON u.id=m.user_id
    WHERE e.organization_id=:org AND e.offering_id=:off AND e.status='active'
      AND s.status='active' AND m.status='active' AND u.status='active'
"""


@router.get(PATH)
async def list_recommendations(
    organization_id: UUID, offering_id: UUID, focus: UUID | None = None,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        params = {"org": organization_id, "off": offering_id, "editor": ctx["editor"],
                  "enrollment": ctx["enrollment_id"], "focus": focus}
        recipients = []
        if ctx["editor"]:
            recipients = (await conn.execute(text(RECIPIENTS + " ORDER BY u.full_name LIMIT 500"), params)).mappings().all()
        rows = (await conn.execute(text("""
            SELECT r.id,r.title,r.body,r.priority,r.created_at,r.completed_at,
                   author.full_name AS author, recipient.full_name AS recipient
            FROM app.teacher_recommendations r
            JOIN app.enrollments e ON e.organization_id=r.organization_id AND e.id=r.enrollment_id
            JOIN app.students s ON s.organization_id=e.organization_id AND s.id=e.student_id
            JOIN app.organization_memberships m ON m.organization_id=s.organization_id AND m.id=s.membership_id
            JOIN app.users recipient ON recipient.id=m.user_id
            JOIN app.users author ON author.id=r.created_by
            WHERE r.organization_id=:org AND e.offering_id=:off
              AND (:editor OR r.enrollment_id=:enrollment)
            ORDER BY (r.id=CAST(:focus AS uuid)) DESC NULLS LAST,r.created_at DESC,r.id LIMIT 200
        """), params)).mappings().all()
        return {"editor": ctx["editor"], "recipients": [dict(row) for row in recipients],
                "items": [dict(row) for row in rows]}


@router.post(PATH, status_code=201)
async def create_recommendation(
    organization_id: UUID, offering_id: UUID, payload: RecommendationIn,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        _editor(ctx)
        params = {"org": organization_id, "off": offering_id, "enrollment": payload.enrollment_id,
                  "actor": ctx["actor"], "title": payload.title, "body": payload.body, "priority": payload.priority}
        # INSERT SELECT evita aceptar una matrícula de otra oferta incluso con UUID válido.
        row = (await conn.execute(text("""
            INSERT INTO app.teacher_recommendations(organization_id,enrollment_id,created_by,title,body,priority)
            SELECT :org, target.id,:actor,:title,:body,:priority FROM (
        """ + RECIPIENTS + " AND e.id=:enrollment) target RETURNING id"), params)).scalar_one_or_none()
        if row is None:
            raise HTTPException(404, "Matrícula activa no disponible en esta oferta")
        await _audit(conn, organization_id, ctx["actor"], "create", "teacher_recommendation", row)
        return {"id": row}


@router.patch(PATH + "/{recommendation_id}/complete")
async def complete_recommendation(
    organization_id: UUID, offering_id: UUID, recommendation_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        enrollment = _student(ctx)
        params = {"org": organization_id, "off": offering_id, "enrollment": enrollment, "id": recommendation_id}
        row = (await conn.execute(text("""
            UPDATE app.teacher_recommendations r SET completed_at=now()
            FROM app.enrollments e WHERE r.id=:id AND r.organization_id=:org
              AND r.enrollment_id=:enrollment AND e.organization_id=r.organization_id
              AND e.id=r.enrollment_id AND e.offering_id=:off AND r.completed_at IS NULL
            RETURNING r.id
        """), params)).scalar_one_or_none()
        if row is None:
            raise HTTPException(404, "Recomendación pendiente no disponible")
        await _audit(conn, organization_id, ctx["actor"], "complete", "teacher_recommendation", row)
        return {"id": row}


@router.get(PATH + "/suggestions")
async def list_suggestions(
    organization_id: UUID, offering_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Reglas de tareas pendientes: lectura exclusiva de la matrícula autenticada."""
    async with engine.connect() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        if (ctx["editor"] or ctx["enrollment_status"] != "active"
                or ctx["offering_status"] != "open" or ctx["course_status"] != "published"):
            return {"items": []}
        enrollment = _student(ctx)
        rows = (await conn.execute(text("""
            SELECT t.id AS task_id, t.title, t.due_at,
                   CASE WHEN t.due_at <= now() + interval '48 hours'
                        THEN 'high' ELSE 'normal' END AS priority
            FROM app.course_tasks t
            WHERE t.organization_id=:org AND t.offering_id=:off AND t.status='published'
              AND (t.due_at IS NULL OR t.due_at >= now())
              AND NOT EXISTS (
                SELECT 1 FROM app.task_submissions s
                WHERE s.organization_id=t.organization_id AND s.task_id=t.id
                  AND s.enrollment_id=:enrollment
              )
            ORDER BY t.due_at NULLS LAST, t.id LIMIT 50
        """), {"org": organization_id, "off": offering_id,
                "enrollment": enrollment})).mappings().all()
        return {"items": [dict(row) for row in rows]}
