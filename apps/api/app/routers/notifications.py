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
        e.offering_id,r.title,r.id AS target_id
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
 UNION ALL
 SELECT DISTINCT n.id,n.organization_id,n.event_type,n.resource_id,n.created_at,n.read_at,
        v.offering_id,v.title,v.target_id
 FROM app.notifications n
 JOIN app.users u ON u.id=n.recipient_id AND u.status='active'
 JOIN app.notification_academic_events v ON v.organization_id=n.organization_id
  AND v.resource_id=n.resource_id AND v.event_type=n.event_type
  AND v.resource_type=n.resource_type AND v.recipient_id=n.recipient_id
 WHERE u.auth_user_id=:auth_id
 UNION ALL
 SELECT DISTINCT n.id,n.organization_id,n.event_type,n.resource_id,n.created_at,n.read_at,
        v.offering_id,v.title,v.target_id
 FROM app.notifications n
 JOIN app.users u ON u.id=n.recipient_id AND u.status='active'
 JOIN (SELECT * FROM app.notification_reminder_events
       UNION ALL SELECT * FROM app.notification_management_events) v
   ON v.organization_id=n.organization_id AND v.resource_id=n.resource_id
  AND v.event_type=n.event_type AND v.resource_type=n.resource_type AND v.recipient_id=n.recipient_id
 WHERE u.auth_user_id=:auth_id
"""

# Se materializan solo avisos del usuario autenticado. Una clave por tarea y tipo.
MATERIALIZE = """
 INSERT INTO app.notifications(organization_id,recipient_id,actor_id,event_type,resource_type,resource_id,deduplication_key)
 SELECT DISTINCT v.organization_id,v.recipient_id,v.actor_id,v.event_type,v.resource_type,v.resource_id,
        v.event_type || ':' || v.resource_id::text
 FROM app.notification_reminder_events v
 JOIN app.users u ON u.id=v.recipient_id AND u.status='active'
 WHERE u.auth_user_id=:auth_id
 ON CONFLICT (recipient_id,deduplication_key) DO NOTHING
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


@router.post("/refresh")
async def refresh_notifications(
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Genera recordatorios vigentes sin un servicio de planificación externo."""
    async with engine.begin() as conn:
        await conn.execute(text(MATERIALIZE), {"auth_id": auth_id})
    return await list_notifications(auth_id, engine)


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


@router.get("/academic-pending")
async def academic_pending(
    organization_id: UUID, auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Recordatorios actuales, independientemente de su estado de lectura."""
    async with engine.connect() as conn:
        rows = (await conn.execute(text("""
            SELECT DISTINCT v.event_type,v.offering_id,v.target_id,v.title,
                   c.title AS course_title,t.due_at
            FROM app.notification_reminder_events v
            JOIN app.course_tasks t ON t.id=v.target_id AND t.organization_id=v.organization_id
              AND t.offering_id=v.offering_id
            JOIN app.course_offerings off ON off.id=v.offering_id AND off.organization_id=v.organization_id
            JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
            JOIN app.users u ON u.id=v.recipient_id AND u.status='active'
            WHERE u.auth_user_id=:auth_id AND v.organization_id=:org
            ORDER BY v.event_type,t.due_at NULLS LAST,v.title,v.target_id LIMIT 200
        """), {"auth_id": auth_id, "org": organization_id})).mappings().all()
    return {"items": [dict(row) for row in rows]}
