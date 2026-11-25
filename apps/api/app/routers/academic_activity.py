"""Actividad académica y ciclo de matrículas (incremento 16).

Todas las consultas aplican el ámbito de institución en SQL. Una persona docente
solo accede a ofertas en las que figure como docente activo; el superadministrador
NO hereda permisos operativos. Los datos son evidencias, no predicciones de IA.
"""
import logging
from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic import SCOPE_SQL, _require_scope

router = APIRouter(prefix="/api/v1/academic/organizations", tags=["academic-activity"])
logger = logging.getLogger(__name__)


class ActivityCreate(BaseModel):
    """Cada tipo requiere exclusivamente sus campos correspondientes."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    enrollment_id: UUID
    kind: Literal["grade", "attendance", "participation"]
    title: str = Field(min_length=2, max_length=120)
    activity_date: date = Field(default_factory=date.today)
    score: Decimal | None = Field(default=None, ge=0, max_digits=7, decimal_places=2)
    max_score: Decimal | None = Field(default=None, gt=0, max_digits=7, decimal_places=2)
    attendance_status: Literal["present", "late", "absent", "excused"] | None = None
    participation_rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def valid_type(self):
        if self.activity_date > date.today():
            raise ValueError("No se pueden registrar evidencias con una fecha futura")
        if self.kind == "grade":
            if self.score is None or self.max_score is None or self.score > self.max_score:
                raise ValueError("La nota debe estar entre 0 y el puntaje máximo")
            if self.attendance_status is not None or self.participation_rating is not None:
                raise ValueError("Una nota no admite asistencia ni participación")
        elif self.kind == "attendance":
            if self.attendance_status is None or any(v is not None for v in (self.score, self.max_score, self.participation_rating)):
                raise ValueError("La asistencia requiere únicamente su estado")
        elif self.participation_rating is None or any(v is not None for v in (self.score, self.max_score, self.attendance_status)):
            raise ValueError("La participación requiere únicamente una valoración de 1 a 5")
        return self


class ProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enrollment_id: UUID
    completion_percent: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)


class EnrollmentStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["active", "completed", "withdrawn"]


class InstructorAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    instructor_id: UUID | None = None


async def _actor_scope(conn: AsyncConnection, auth_id: UUID, organization_id: UUID) -> dict:
    """No revela instituciones ajenas y devuelve permisos reales de la BD."""
    row = (await conn.execute(SCOPE_SQL, {
        "auth_id": auth_id, "organization_id": organization_id,
    })).mappings().first()
    if not row or not (row["is_global_admin"] or row["is_member"]):
        raise HTTPException(status_code=404, detail="Institución no disponible")
    return dict(row)


ASSIGNED_INSTRUCTOR = """
    EXISTS (
      SELECT 1 FROM app.instructors i
      JOIN app.organization_memberships m ON m.id=i.membership_id
        AND m.organization_id=i.organization_id AND m.status='active'
      JOIN app.membership_roles mr ON mr.membership_id=m.id
      JOIN app.roles r ON r.id=mr.role_id AND r.code='instructor' AND r.scope='organization'
      WHERE i.organization_id=off.organization_id AND i.id=off.instructor_id
        AND i.status='active' AND m.user_id=:actor
    )
"""


async def _offering_permission(
    conn: AsyncConnection, auth_id: UUID, organization_id: UUID, offering_id: UUID,
) -> UUID:
    """Un gestor institucional o docente asignado puede operar esta oferta."""
    scope = await _actor_scope(conn, auth_id, organization_id)
    row = (await conn.execute(text(f"""
        SELECT off.id, {ASSIGNED_INSTRUCTOR} AS assigned
        FROM app.course_offerings off
        WHERE off.organization_id=:organization_id AND off.id=:offering_id
          AND off.status <> 'cancelled'
    """), {"actor": scope["actor_id"], "organization_id": organization_id,
           "offering_id": offering_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Oferta académica no disponible")
    if not (scope["is_manager"] or row["assigned"]):
        raise HTTPException(status_code=403, detail="No tienes permisos sobre esta oferta académica")
    return scope["actor_id"]


async def _active_enrollment(
    conn: AsyncConnection, organization_id: UUID, offering_id: UUID, enrollment_id: UUID,
) -> dict:
    """Bloqueo transaccional para impedir escrituras posteriores a la baja."""
    row = (await conn.execute(text("""
        SELECT e.id, e.student_id, off.course_id, e.status
        FROM app.enrollments e
        JOIN app.course_offerings off ON off.id=e.offering_id AND off.organization_id=e.organization_id
        JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
        JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=e.organization_id
        JOIN app.users u ON u.id=m.user_id
        WHERE e.organization_id=:organization_id AND e.offering_id=:offering_id
          AND e.id=:enrollment_id AND s.status='active' AND m.status='active' AND u.status='active'
        FOR UPDATE OF e
    """), {"organization_id": organization_id, "offering_id": offering_id,
           "enrollment_id": enrollment_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Matrícula no disponible en esta oferta")
    if row["status"] != "active":
        raise HTTPException(status_code=409, detail="Solo se registran evidencias en matrículas activas")
    return dict(row)


async def _audit(conn: AsyncConnection, organization_id: UUID, actor: UUID, action: str,
                 resource: str, resource_id: UUID) -> None:
    """No guarda notas ni contenido personal en auditoría."""
    await conn.execute(text("""
        INSERT INTO app.audit_logs (organization_id, actor_id, action, resource, resource_id)
        VALUES (:organization_id, :actor, :action, :resource, :resource_id)
    """), {"organization_id": organization_id, "actor": actor, "action": action,
           "resource": resource, "resource_id": resource_id})


def _sql_failure(exc: SQLAlchemyError) -> HTTPException:
    logger.exception("Error SQL en actividad académica")
    return HTTPException(status_code=503, detail="Error de base de datos: verifica la migración académica 005")


@router.get("/{organization_id}/activity/offerings")
async def activity_offerings(
    organization_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Gestor: todas las ofertas no canceladas; docente: solo las asignadas."""
    sql = text(f"""
        SELECT off.id::text AS id, c.title AS course_title, c.code AS course_code,
          off.period, off.status, off.instructor_id::text AS instructor_id,
          c.id::text AS course_id, c.status AS course_status,
          c.appearance_icon AS course_icon, c.appearance_color AS course_color,
          off.appearance_icon_override AS offering_icon_override,
          off.appearance_color_override AS offering_color_override,
          COALESCE(off.appearance_icon_override,c.appearance_icon) AS appearance_icon,
          COALESCE(off.appearance_color_override,c.appearance_color) AS appearance_color,
          u.full_name AS instructor_name,
          (SELECT COUNT(*) FROM app.enrollments e
           WHERE e.organization_id=off.organization_id AND e.offering_id=off.id
             AND e.status='active') AS active_enrollments
        FROM app.course_offerings off
        JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
        LEFT JOIN app.instructors i ON i.id=off.instructor_id AND i.organization_id=off.organization_id
        LEFT JOIN app.organization_memberships m ON m.id=i.membership_id AND m.organization_id=i.organization_id
        LEFT JOIN app.users u ON u.id=m.user_id
        WHERE off.organization_id=:organization_id AND off.status<>'cancelled'
          AND (:manager OR {ASSIGNED_INSTRUCTOR})
        ORDER BY off.created_at DESC LIMIT 200
    """)
    try:
        async with engine.connect() as conn:
            scope = await _actor_scope(conn, auth_id, organization_id)
            rows = (await conn.execute(sql, {"organization_id": organization_id,
                "manager": scope["is_manager"], "actor": scope["actor_id"]})).mappings().all()
        return {"items": [dict(row) for row in rows], "can_manage": bool(scope["is_manager"])}
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.get("/{organization_id}/activity/offerings/{offering_id}/overview")
async def activity_overview(
    organization_id: UUID, offering_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Resumen de evidencias por estudiante, sin inferencias predictivas."""
    sql = text("""
        SELECT e.id::text AS enrollment_id, e.student_id::text AS student_id,
          e.status, u.full_name AS student_name, u.email_normalized AS student_email,
          COALESCE(p.completion_ratio,0)*100 AS completion_percent,
          (SELECT COUNT(*) FROM app.academic_activity_records a
             WHERE a.organization_id=e.organization_id AND a.enrollment_id=e.id
               AND a.kind='grade' AND a.voided_at IS NULL) AS grade_count,
          (SELECT ROUND(AVG(a.score / a.max_score * 100),2) FROM app.academic_activity_records a
             WHERE a.organization_id=e.organization_id AND a.enrollment_id=e.id
               AND a.kind='grade' AND a.voided_at IS NULL) AS grade_average_percent,
          (SELECT COUNT(*) FROM app.academic_activity_records a
             WHERE a.organization_id=e.organization_id AND a.enrollment_id=e.id
               AND a.kind='attendance' AND a.voided_at IS NULL) AS attendance_count,
          (SELECT ROUND(AVG(CASE WHEN a.attendance_status IN ('present','late') THEN 100
                 WHEN a.attendance_status='absent' THEN 0 ELSE NULL END),2)
             FROM app.academic_activity_records a
             WHERE a.organization_id=e.organization_id AND a.enrollment_id=e.id
               AND a.kind='attendance' AND a.voided_at IS NULL) AS attendance_percent,
          (SELECT ROUND(AVG(a.participation_rating::numeric),2) FROM app.academic_activity_records a
             WHERE a.organization_id=e.organization_id AND a.enrollment_id=e.id
               AND a.kind='participation' AND a.voided_at IS NULL) AS participation_average
        FROM app.enrollments e
        JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
        JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=s.organization_id
        JOIN app.users u ON u.id=m.user_id
        LEFT JOIN app.progress_snapshots p ON p.organization_id=e.organization_id
          AND p.student_id=e.student_id AND p.offering_id=e.offering_id
        WHERE e.organization_id=:organization_id AND e.offering_id=:offering_id
        ORDER BY u.full_name LIMIT 500
    """)
    try:
        async with engine.connect() as conn:
            await _offering_permission(conn, auth_id, organization_id, offering_id)
            rows = (await conn.execute(sql, {"organization_id": organization_id,
                "offering_id": offering_id})).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.get("/{organization_id}/activity/offerings/{offering_id}/records")
async def activity_records(
    organization_id: UUID, offering_id: UUID,
    enrollment_id: UUID = Query(..., description="Matrícula concreta cuyo historial se consulta"),
    limit: int = Query(10, ge=1, le=50), offset: int = Query(0, ge=0),
    kind: Literal["grade", "attendance", "participation"] | None = None,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Historial paginado POR MATRÍCULA. Nunca devuelve evidencias masivas.

    Los filtros y la comprobación de oferta se aplican en SQL y también se
    exige que el actor sea gestor o docente asignado a la oferta.
    """
    conditions = """
        FROM app.academic_activity_records a
        JOIN app.enrollments e ON e.id=a.enrollment_id AND e.organization_id=a.organization_id
        JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
        JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=s.organization_id
        JOIN app.users u ON u.id=m.user_id
        WHERE a.organization_id=:organization_id AND e.offering_id=:offering_id
          AND e.id=:enrollment_id AND a.voided_at IS NULL
          AND (CAST(:kind AS text) IS NULL OR a.kind=CAST(:kind AS text))
    """
    parameters = {"organization_id": organization_id, "offering_id": offering_id,
                  "enrollment_id": enrollment_id, "kind": kind}
    try:
        async with engine.connect() as conn:
            await _offering_permission(conn, auth_id, organization_id, offering_id)
            enrollment_exists = (await conn.execute(text("""
                SELECT 1 FROM app.enrollments
                WHERE id=:enrollment_id AND offering_id=:offering_id
                  AND organization_id=:organization_id
            """), parameters)).first()
            if not enrollment_exists:
                raise HTTPException(status_code=404, detail="Matrícula no disponible en esta oferta")
            total = (await conn.execute(text("SELECT COUNT(*) " + conditions), parameters)).scalar_one()
            rows = (await conn.execute(text("""
                SELECT a.id::text AS id, a.enrollment_id::text AS enrollment_id, a.kind,
                  a.title, a.activity_date, a.score, a.max_score, a.attendance_status,
                  a.participation_rating, a.notes, a.recorded_at,
                  u.full_name AS student_name
            """ + conditions + """
                ORDER BY a.activity_date DESC, a.recorded_at DESC, a.id DESC
                LIMIT :limit OFFSET :offset
            """), {**parameters, "limit": limit, "offset": offset})).mappings().all()
        return {"items": [dict(row) for row in rows], "total": total,
                "limit": limit, "offset": offset}
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.post("/{organization_id}/activity/offerings/{offering_id}/records",
             status_code=status.HTTP_201_CREATED)
async def create_activity_record(
    organization_id: UUID, offering_id: UUID, payload: ActivityCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Registra evidencia real y auditoría en una sola transacción."""
    try:
        async with engine.begin() as conn:
            actor = await _offering_permission(conn, auth_id, organization_id, offering_id)
            row = await _active_enrollment(conn, organization_id, offering_id, payload.enrollment_id)
            record_id = (await conn.execute(text("""
                INSERT INTO app.academic_activity_records
                  (organization_id, enrollment_id, kind, title, activity_date,
                   score, max_score, attendance_status, participation_rating,
                   notes, recorded_by)
                VALUES (:organization_id, :enrollment_id, :kind, :title, :activity_date,
                        :score, :max_score, :attendance_status, :participation_rating,
                        :notes, :actor)
                RETURNING id
            """), {**payload.model_dump(), "organization_id": organization_id,
                  "actor": actor})).scalar_one()
            # Evento inmutable sin nombre ni comentarios personales.
            await conn.execute(text("""
                INSERT INTO app.learning_events
                  (organization_id, student_id, course_id, actor_id, event_type, payload)
                VALUES (:organization_id, :student_id, :course_id, :actor, :event_type,
                  jsonb_build_object('record_id', CAST(:record_id AS text)))
            """), {"organization_id": organization_id, "student_id": row["student_id"],
                   "course_id": row["course_id"], "actor": actor,
                   "event_type": f"academic.{payload.kind}.recorded", "record_id": str(record_id)})
            await _audit(conn, organization_id, actor, "create", "academic_activity_records", record_id)
        return {"id": str(record_id), "message": "Evidencia registrada"}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="La evidencia ya existe o incumple una restricción") from exc
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.delete("/{organization_id}/activity/offerings/{offering_id}/records/{record_id}")
async def void_activity_record(
    organization_id: UUID, offering_id: UUID, record_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Anula errores sin borrar evidencias históricas ni la auditoría."""
    try:
        async with engine.begin() as conn:
            actor = await _offering_permission(conn, auth_id, organization_id, offering_id)
            row = (await conn.execute(text("""
                SELECT a.id, a.enrollment_id FROM app.academic_activity_records a
                JOIN app.enrollments e ON e.id=a.enrollment_id
                  AND e.organization_id=a.organization_id
                WHERE a.organization_id=:organization_id AND a.id=:record_id
                  AND e.offering_id=:offering_id AND a.voided_at IS NULL
                FOR UPDATE OF a
            """), {"organization_id": organization_id, "offering_id": offering_id,
                    "record_id": record_id})).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Evidencia no disponible")
            # Las notas vinculadas a rúbricas tienen una fuente única y trazable.
            # Deben rectificarse desde la revisión de la tarea, no anularse aquí.
            linked = (await conn.execute(text("""
                SELECT 1 FROM app.task_official_grades
                WHERE organization_id=:organization_id AND academic_record_id=:record_id
                LIMIT 1
            """), {"organization_id": organization_id, "record_id": record_id})).first()
            if linked:
                raise HTTPException(status_code=409, detail="Rectifica esta nota desde la tarea evaluada")
            await _active_enrollment(conn, organization_id, offering_id, row["enrollment_id"])
            await conn.execute(text("""
                UPDATE app.academic_activity_records
                SET voided_at=now(), voided_by=:actor
                WHERE organization_id=:organization_id AND id=:record_id
            """), {"organization_id": organization_id, "record_id": record_id, "actor": actor})
            await _audit(conn, organization_id, actor, "void", "academic_activity_records", record_id)
        return {"message": "Evidencia anulada; se conserva el historial"}
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.put("/{organization_id}/activity/offerings/{offering_id}/progress")
async def update_progress(
    organization_id: UUID, offering_id: UUID, payload: ProgressUpdate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    try:
        async with engine.begin() as conn:
            actor = await _offering_permission(conn, auth_id, organization_id, offering_id)
            row = await _active_enrollment(conn, organization_id, offering_id, payload.enrollment_id)
            snapshot = (await conn.execute(text("""
                INSERT INTO app.progress_snapshots
                  (organization_id, student_id, offering_id, completion_ratio)
                VALUES (:organization_id, :student_id, :offering_id,
                        CAST(:completion_percent AS numeric)/100)
                ON CONFLICT (organization_id, student_id, offering_id)
                DO UPDATE SET completion_ratio=EXCLUDED.completion_ratio, updated_at=now()
                RETURNING id
            """), {"organization_id": organization_id, "student_id": row["student_id"],
                    "offering_id": offering_id,
                    "completion_percent": payload.completion_percent})).scalar_one()
            await conn.execute(text("""
                INSERT INTO app.learning_events
                  (organization_id, student_id, course_id, actor_id, event_type, payload)
                VALUES (:organization_id, :student_id, :course_id, :actor,
                  'academic.progress.updated',
                  jsonb_build_object('percent', CAST(:completion_percent AS numeric)))
            """), {"organization_id": organization_id, "student_id": row["student_id"],
                    "course_id": row["course_id"], "actor": actor,
                    "completion_percent": payload.completion_percent})
            await _audit(conn, organization_id, actor, "update", "progress_snapshots", snapshot)
        return {"message": "Progreso actualizado"}
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.patch("/{organization_id}/enrollments/{enrollment_id}/status")
async def update_enrollment_status(
    organization_id: UUID, enrollment_id: UUID, payload: EnrollmentStatusUpdate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Gestor cambia estados; completada es terminal y reingreso requiere oferta abierta."""
    try:
        async with engine.begin() as conn:
            actor = await _require_scope(conn, auth_id, organization_id, manage=True)
            row = (await conn.execute(text("""
                SELECT e.id, e.status, off.status AS offering_status,
                  s.status AS student_status, m.status AS membership_status,
                  u.status AS user_status
                FROM app.enrollments e
                JOIN app.course_offerings off ON off.id=e.offering_id AND off.organization_id=e.organization_id
                JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
                JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=e.organization_id
                JOIN app.users u ON u.id=m.user_id
                WHERE e.organization_id=:organization_id AND e.id=:enrollment_id
                FOR UPDATE OF e
            """), {"organization_id": organization_id, "enrollment_id": enrollment_id})).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Matrícula no disponible")
            current, target = row["status"], payload.status
            if current == target:
                return {"message": "La matrícula ya tiene ese estado"}
            allowed = (current == "active" and target in ("completed", "withdrawn")) or (
                current == "withdrawn" and target == "active"
                and row["offering_status"] == "open"
                and row["student_status"] == "active"
                and row["membership_status"] == "active"
                and row["user_status"] == "active"
            )
            if not allowed:
                raise HTTPException(status_code=409, detail="Transición de matrícula no permitida")
            await conn.execute(text("""
                UPDATE app.enrollments SET status=:target
                WHERE organization_id=:organization_id AND id=:enrollment_id
            """), {"organization_id": organization_id, "enrollment_id": enrollment_id,
                    "target": target})
            await _audit(conn, organization_id, actor, "status_update", "enrollments", enrollment_id)
        return {"message": "Estado de matrícula actualizado"}
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.get("/{organization_id}/instructors")
async def list_instructors(
    organization_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Sólo gestores pueden consultar el directorio docente para asignaciones."""
    try:
        async with engine.connect() as conn:
            await _require_scope(conn, auth_id, organization_id, manage=True)
            rows = (await conn.execute(text("""
                SELECT i.id::text AS id, u.full_name AS name
                FROM app.instructors i
                JOIN app.organization_memberships m ON m.id=i.membership_id
                  AND m.organization_id=i.organization_id AND m.status='active'
                JOIN app.users u ON u.id=m.user_id AND u.status='active'
                JOIN app.membership_roles mr ON mr.membership_id=m.id
                JOIN app.roles r ON r.id=mr.role_id AND r.code='instructor' AND r.scope='organization'
                WHERE i.organization_id=:organization_id AND i.status='active'
                ORDER BY u.full_name LIMIT 250
            """), {"organization_id": organization_id})).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc


@router.put("/{organization_id}/offerings/{offering_id}/instructor")
async def assign_instructor(
    organization_id: UUID, offering_id: UUID, payload: InstructorAssignment,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Asigna sólo docentes activos del mismo tenant; NULL permite desasignar."""
    try:
        async with engine.begin() as conn:
            actor = await _require_scope(conn, auth_id, organization_id, manage=True)
            offering = (await conn.execute(text("""
                SELECT id FROM app.course_offerings
                WHERE organization_id=:organization_id AND id=:offering_id
                  AND status<>'cancelled' FOR UPDATE
            """), {"organization_id": organization_id, "offering_id": offering_id})).first()
            if not offering:
                raise HTTPException(status_code=404, detail="Oferta no disponible")
            if payload.instructor_id is not None:
                active = (await conn.execute(text("""
                    SELECT 1 FROM app.instructors i
                    JOIN app.organization_memberships m ON m.id=i.membership_id
                      AND m.organization_id=i.organization_id AND m.status='active'
                    JOIN app.users u ON u.id=m.user_id AND u.status='active'
                    JOIN app.membership_roles mr ON mr.membership_id=m.id
                    JOIN app.roles r ON r.id=mr.role_id AND r.code='instructor' AND r.scope='organization'
                    WHERE i.organization_id=:organization_id AND i.id=:instructor_id
                      AND i.status='active'
                """), {"organization_id": organization_id,
                        "instructor_id": payload.instructor_id})).first()
                if not active:
                    raise HTTPException(status_code=422, detail="Docente inactivo o de otra institución")
            await conn.execute(text("""
                UPDATE app.course_offerings SET instructor_id=:instructor_id
                WHERE organization_id=:organization_id AND id=:offering_id
            """), {"organization_id": organization_id, "offering_id": offering_id,
                    "instructor_id": payload.instructor_id})
            await _audit(conn, organization_id, actor, "assign_instructor", "course_offerings", offering_id)
        return {"message": "Docente asignado"}
    except IntegrityError as exc:
        raise HTTPException(status_code=422, detail="El docente debe pertenecer a la institución") from exc
    except SQLAlchemyError as exc:
        raise _sql_failure(exc) from exc
