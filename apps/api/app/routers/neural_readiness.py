"""Diagnóstico agregado de fuentes académicas; no exporta filas personales."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.organizations import _require_superadmin

router = APIRouter(prefix="/api/v1/neural-academic", tags=["neural-academic"])

# Cada fuente se limita a una institución; no se leen notas, textos ni payloads.
COVERAGE = text("""
    SELECT
      (SELECT count(*) FROM app.enrollments WHERE organization_id=:org) AS enrollments,
      (SELECT count(*) FROM app.course_offerings WHERE organization_id=:org) AS offerings,
      (SELECT count(*) FROM app.learning_events WHERE organization_id=:org) AS events,
      (SELECT count(*) FROM app.academic_activity_records
        WHERE organization_id=:org AND voided_at IS NULL) AS activities,
      (SELECT count(*) FROM app.assessment_attempts WHERE organization_id=:org) AS attempts,
      (SELECT count(*) FROM app.progress_snapshots WHERE organization_id=:org) AS progress,
      (SELECT count(*) FROM app.task_submissions WHERE organization_id=:org) AS submissions,
      (SELECT count(*) FROM app.task_official_grades WHERE organization_id=:org) AS grades,
      (SELECT count(*) FROM app.skill_evidence WHERE organization_id=:org) AS skills
""")


@router.get("/organizations/{organization_id}/readiness")
async def readiness(
    organization_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Inventario de registros, no certificación de aptitud para entrenamiento."""
    async with engine.begin() as conn:
        await _require_superadmin(conn, auth_id)
        await conn.execute(text("SET LOCAL statement_timeout = '5000ms'"))
        params = {"org": organization_id}
        exists = (await conn.execute(text("""
            SELECT id FROM app.organizations WHERE id=:org AND status='active'
        """), params)).scalar_one_or_none()
        if exists is None:
            raise HTTPException(404, "Institución activa no encontrada")
        counts = (await conn.execute(COVERAGE, params)).mappings().one()
        return {"organization_id": str(organization_id), "counts": dict(counts),
                "training_authorized": False, "classification": "AGGREGATE_ONLY"}
