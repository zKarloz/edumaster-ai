"""Bandeja privada. Se revalida el acceso actual al recurso incluso después del evento."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

# La identidad procede del JWT; no se acepta destinatario ni institución del cliente.
VISIBLE = """
 SELECT n.id,n.organization_id,n.event_type,n.resource_id,n.created_at,n.read_at,
        e.offering_id,r.title
 FROM app.notifications n
 JOIN app.users u ON u.id=n.recipient_id AND u.status='active'
 JOIN app.organizations o ON o.id=n.organization_id AND o.status='active'
 JOIN app.teacher_recommendations r ON r.id=n.resource_id AND r.organization_id=n.organization_id
 JOIN app.enrollments e ON e.id=r.enrollment_id AND e.organization_id=r.organization_id
 JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
 JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=s.organization_id
 JOIN app.course_offerings off ON off.id=e.offering_id AND off.organization_id=e.organization_id
 JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
 WHERE u.auth_user_id=:auth_id AND m.user_id=u.id AND m.status='active'
 AND s.status='active' AND e.status IN ('active','completed')
 AND off.status<>'cancelled' AND c.status='published'
 AND n.event_type='recommendation_created'
"""


@router.get("")
async def list_notifications(
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
) -> dict:
    async with engine.connect() as conn:
        params = {"auth_id": auth_id}
        count = (await conn.execute(text(f"SELECT count(*) FROM ({VISIBLE}) v WHERE read_at IS NULL"), params)).scalar_one()
        rows = (await conn.execute(text(f"""
            SELECT * FROM ({VISIBLE}) v ORDER BY (read_at IS NULL) DESC,created_at DESC,id DESC LIMIT 50
        """), params)).mappings().all()
        return {"unread": count, "items": [dict(row) for row in rows]}


@router.patch("/read-all")
async def read_all(
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
) -> dict:
    async with engine.begin() as conn:
        await conn.execute(text(f"""
            UPDATE app.notifications SET read_at=now()
            WHERE read_at IS NULL AND id IN (SELECT id FROM ({VISIBLE}) v)
        """), {"auth_id": auth_id})
    return {"ok": True}


@router.patch("/{notification_id}/read")
async def read_notification(
    notification_id: UUID, auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    async with engine.begin() as conn:
        found = (await conn.execute(text(f"""
            UPDATE app.notifications SET read_at=coalesce(read_at,now())
            WHERE id=:id AND id IN (SELECT id FROM ({VISIBLE}) v) RETURNING id
        """), {"auth_id": auth_id, "id": notification_id})).scalar_one_or_none()
        if found is None:
            raise HTTPException(404, "Notificación no disponible")
    return {"ok": True}
