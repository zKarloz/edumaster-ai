"""Núcleo académico: cursos, estudiantes vinculados a Auth y matrículas.

Cada consulta recibe el ámbito de organización y verifica permisos en FastAPI.
Las FK compuestas existentes en PostgreSQL refuerzan el aislamiento entre tenants.
No crea cuentas de Auth ni publica resultados de IA a estudiantes.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id

router = APIRouter(prefix="/api/v1/academic/organizations", tags=["academic"])
logger = logging.getLogger(__name__)


class CourseCreate(BaseModel):
    """Curso + oferta inicial, creados en una transacción."""
    model_config = ConfigDict(str_strip_whitespace=True)
    code: str = Field(min_length=3, max_length=40, pattern=r"^[a-z0-9][a-z0-9_-]{2,39}$")
    title: str = Field(min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=2000)
    level: str | None = Field(default=None, max_length=80)
    period: str = Field(min_length=3, max_length=80)
    status: str = Field(default="published", pattern=r"^(draft|published)$")

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class StudentCreate(BaseModel):
    """Vincula un usuario de Auth YA existente y confirmado a la institución."""
    model_config = ConfigDict(str_strip_whitespace=True)
    email: str = Field(min_length=5, max_length=254)
    full_name: str = Field(min_length=3, max_length=180)
    external_code: str | None = Field(default=None, max_length=60)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.lower()
        if "@" not in value or " " in value or value.startswith("@"):
            raise ValueError("Ingresa un correo electrónico válido")
        return value

    @field_validator("external_code")
    @classmethod
    def normalize_external_code(cls, value: str | None) -> str | None:
        return value or None


class EnrollmentCreate(BaseModel):
    offering_id: UUID
    student_id: UUID


SCOPE_SQL = text("""
    SELECT u.id AS actor_id,
      EXISTS (SELECT 1 FROM app.global_role_assignments gra
        JOIN app.roles gr ON gr.id=gra.role_id
        WHERE gra.user_id=u.id AND gr.code='superadmin' AND gr.scope='global') AS is_global_admin,
      EXISTS (SELECT 1 FROM app.organization_memberships m
        WHERE m.organization_id=o.id AND m.user_id=u.id AND m.status='active') AS is_member,
      EXISTS (SELECT 1 FROM app.organization_memberships m
        JOIN app.membership_roles mr ON mr.membership_id=m.id
        JOIN app.roles r ON r.id=mr.role_id
        WHERE m.organization_id=o.id AND m.user_id=u.id AND m.status='active'
          AND r.scope='organization' AND r.code IN ('institution_admin','coordinator')) AS is_manager
    FROM app.users u
    JOIN app.organizations o ON o.id=:organization_id AND o.status='active'
    WHERE u.auth_user_id=:auth_id AND u.status='active'
""")


async def _require_scope(
    conn: AsyncConnection, auth_id: UUID, organization_id: UUID, *, manage: bool = False,
) -> UUID:
    """Valida alcance antes de consultar/modificar filas del tenant."""
    row = (await conn.execute(SCOPE_SQL, {
        "auth_id": auth_id, "organization_id": organization_id,
    })).mappings().first()
    if not row or not (row["is_global_admin"] or row["is_member"]):
        # No revelamos si existe una institución inaccesible.
        raise HTTPException(status_code=404, detail="Institución no disponible")
    # El rol global no habilita operaciones académicas de rutina.
    # Solo los gestores institucionales autorizados pueden escribir/listar datos sensibles.
    if manage and not row["is_manager"]:
        raise HTTPException(status_code=403, detail="Necesitas permisos de gestión académica")
    return row["actor_id"]


def _db_error(exc: SQLAlchemyError, message: str) -> HTTPException:
    logger.exception("Fallo SQL en el núcleo académico")
    return HTTPException(status_code=503, detail=message)


@router.get("/{organization_id}/courses")
async def list_courses(
    organization_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Lista cursos de la institución. Borradores solo para gestores."""
    sql = text("""
        SELECT c.id::text AS id, c.code, c.title, c.description, c.level, c.status,
               off.id::text AS offering_id, off.period, off.status AS offering_status,
               (SELECT COUNT(*) FROM app.enrollments e
                WHERE e.organization_id=c.organization_id AND e.offering_id=off.id
                  AND e.status='active') AS enrolled_count
        FROM app.courses c
        LEFT JOIN LATERAL (
          SELECT id, period, status FROM app.course_offerings co
          WHERE co.organization_id=c.organization_id AND co.course_id=c.id
          ORDER BY co.created_at DESC LIMIT 1
        ) off ON TRUE
        WHERE c.organization_id=:organization_id
          AND (c.status='published' OR :can_manage)
        ORDER BY c.created_at DESC LIMIT 200
    """)
    try:
        async with engine.connect() as conn:
            await _require_scope(conn, auth_id, organization_id)
            # Los borradores solo se muestran a gestores, no a cualquier miembro.
            row = (await conn.execute(SCOPE_SQL, {
                "auth_id": auth_id, "organization_id": organization_id,
            })).mappings().first()
            can_manage = bool(row["is_manager"])
            rows = (await conn.execute(sql, {
                "organization_id": organization_id, "can_manage": can_manage,
            })).mappings().all()
        return {"items": [dict(item) for item in rows]}
    except SQLAlchemyError as exc:
        raise _db_error(exc, "No se pudieron consultar los cursos") from exc


@router.post("/{organization_id}/courses", status_code=status.HTTP_201_CREATED)
async def create_course(
    organization_id: UUID, payload: CourseCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Crea curso y oferta (open si publicado) como una operación indivisible."""
    try:
        async with engine.begin() as conn:
            actor = await _require_scope(conn, auth_id, organization_id, manage=True)
            course_id = (await conn.execute(text("""
                INSERT INTO app.courses
                  (organization_id, code, title, description, level, status)
                VALUES (:organization_id, :code, :title, :description, :level, :status)
                RETURNING id
            """), {**payload.model_dump(exclude={"period"}),
                    "organization_id": organization_id})).scalar_one()
            offering_id = (await conn.execute(text("""
                INSERT INTO app.course_offerings
                  (organization_id, course_id, period, status)
                VALUES (:organization_id, :course_id, :period, :offering_status)
                RETURNING id
            """), {"organization_id": organization_id, "course_id": course_id,
                    "period": payload.period,
                    "offering_status": "open" if payload.status == "published" else "planned"})).scalar_one()
            await conn.execute(text("""
                INSERT INTO app.audit_logs
                  (organization_id, actor_id, action, resource, resource_id)
                VALUES (:organization_id, :actor, 'create', 'courses', :course_id)
            """), {"organization_id": organization_id, "actor": actor, "course_id": course_id})
        return {"id": str(course_id), "offering_id": str(offering_id), "message": "Curso creado"}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="El código de curso ya existe en esta institución") from exc
    except SQLAlchemyError as exc:
        raise _db_error(exc, "No se pudo guardar el curso en PostgreSQL") from exc


@router.get("/{organization_id}/students")
async def list_students(
    organization_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """El directorio nominal solo es visible para gestores académicos."""
    sql = text("""
        SELECT s.id::text AS id, u.full_name, u.email_normalized AS email,
               s.external_code, s.status,
               (SELECT COUNT(*) FROM app.enrollments e
                WHERE e.organization_id=s.organization_id AND e.student_id=s.id
                  AND e.status='active') AS enrollment_count
        FROM app.students s
        JOIN app.organization_memberships m ON m.id=s.membership_id
          AND m.organization_id=s.organization_id AND m.status='active'
        JOIN app.users u ON u.id=m.user_id AND u.status='active'
        WHERE s.organization_id=:organization_id
        ORDER BY u.full_name LIMIT 250
    """)
    try:
        async with engine.connect() as conn:
            await _require_scope(conn, auth_id, organization_id, manage=True)
            rows = (await conn.execute(sql, {"organization_id": organization_id})).mappings().all()
        return {"items": [dict(item) for item in rows]}
    except SQLAlchemyError as exc:
        raise _db_error(exc, "No se pudo consultar el directorio de estudiantes") from exc


@router.post("/{organization_id}/students", status_code=status.HTTP_201_CREATED)
async def create_student(
    organization_id: UUID, payload: StudentCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Da de alta al estudiante institucional usando una cuenta de Auth confirmada.

    La cuenta Auth debe crearse previamente desde Supabase. NO se crea ni se
    reactivan membresías suspendidas/revocadas mediante este endpoint.
    """
    try:
        async with engine.begin() as conn:
            actor = await _require_scope(conn, auth_id, organization_id, manage=True)
            auth_row = (await conn.execute(text("""
                SELECT id, lower(email) AS email
                FROM auth.users
                WHERE lower(email)=:email AND email_confirmed_at IS NOT NULL
            """), {"email": payload.email})).mappings().first()
            if not auth_row:
                raise HTTPException(status_code=422,
                    detail="No existe una cuenta confirmada con ese correo en Supabase Auth")
            app_user = (await conn.execute(text("""
                SELECT id, status FROM app.users WHERE auth_user_id=:auth_user_id
            """), {"auth_user_id": auth_row["id"]})).mappings().first()
            if app_user and app_user["status"] != "active":
                raise HTTPException(status_code=409, detail="La cuenta EduMaster.ai está deshabilitada")
            if app_user:
                user_id = app_user["id"]
            else:
                user_id = (await conn.execute(text("""
                    INSERT INTO app.users (auth_user_id, email_normalized, full_name)
                    VALUES (:auth_user_id, :email, :full_name)
                    RETURNING id
                """), {"auth_user_id": auth_row["id"], "email": payload.email,
                        "full_name": payload.full_name})).scalar_one()
            membership = (await conn.execute(text("""
                SELECT id, status FROM app.organization_memberships
                WHERE organization_id=:organization_id AND user_id=:user_id
            """), {"organization_id": organization_id, "user_id": user_id})).mappings().first()
            if membership and membership["status"] != "active":
                raise HTTPException(status_code=409,
                    detail="La membresía existente no está activa; requiere revisión administrativa")
            if membership:
                membership_id = membership["id"]
            else:
                membership_id = (await conn.execute(text("""
                    INSERT INTO app.organization_memberships
                      (organization_id, user_id, status, joined_at)
                    VALUES (:organization_id, :user_id, 'active', now())
                    RETURNING id
                """), {"organization_id": organization_id, "user_id": user_id})).scalar_one()
            role_id = (await conn.execute(text("""
                SELECT id FROM app.roles WHERE scope='organization' AND code='student'
            """))).scalar_one()
            await conn.execute(text("""
                INSERT INTO app.membership_roles (membership_id, role_id, granted_by)
                VALUES (:membership_id, :role_id, :actor)
                ON CONFLICT (membership_id,role_id) DO NOTHING
            """), {"membership_id": membership_id, "role_id": role_id, "actor": actor})
            student_id = (await conn.execute(text("""
                INSERT INTO app.students (organization_id, membership_id, external_code)
                VALUES (:organization_id, :membership_id, :external_code)
                RETURNING id
            """), {"organization_id": organization_id, "membership_id": membership_id,
                    "external_code": payload.external_code})).scalar_one()
            await conn.execute(text("""
                INSERT INTO app.audit_logs
                  (organization_id, actor_id, action, resource, resource_id)
                VALUES (:organization_id, :actor, 'create', 'students', :student_id)
            """), {"organization_id": organization_id, "actor": actor, "student_id": student_id})
        return {"id": str(student_id), "message": "Estudiante incorporado"}
    except IntegrityError as exc:
        raise HTTPException(status_code=409,
            detail="Estudiante ya registrado o código académico duplicado en esta institución") from exc
    except SQLAlchemyError as exc:
        raise _db_error(exc, "No se pudo incorporar al estudiante en PostgreSQL") from exc


@router.get("/{organization_id}/enrollments")
async def list_enrollments(
    organization_id: UUID,
    offering_id: UUID | None = Query(default=None),
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Gestores acceden a matrículas nominales, filtrables por oferta."""
    sql = text("""
        SELECT e.id::text AS id, e.offering_id::text AS offering_id,
               e.student_id::text AS student_id, e.status,
               u.full_name AS student_name, u.email_normalized AS student_email,
               c.title AS course_title, c.code AS course_code, off.period
        FROM app.enrollments e
        JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
        JOIN app.organization_memberships m ON m.id=s.membership_id
          AND m.organization_id=e.organization_id
        JOIN app.users u ON u.id=m.user_id
        JOIN app.course_offerings off ON off.id=e.offering_id
          AND off.organization_id=e.organization_id
        JOIN app.courses c ON c.id=off.course_id AND c.organization_id=e.organization_id
        WHERE e.organization_id=:organization_id
          AND (CAST(:offering_id AS uuid) IS NULL OR e.offering_id=CAST(:offering_id AS uuid))
        ORDER BY e.enrolled_at DESC LIMIT 500
    """)
    # El parámetro opcional UUID se tipa en la consulta para asyncpg.
    try:
        async with engine.connect() as conn:
            await _require_scope(conn, auth_id, organization_id, manage=True)
            rows = (await conn.execute(sql, {"organization_id": organization_id,
                                            "offering_id": offering_id})).mappings().all()
        return {"items": [dict(item) for item in rows]}
    except SQLAlchemyError as exc:
        raise _db_error(exc, "No se pudieron consultar las matrículas") from exc


@router.post("/{organization_id}/enrollments", status_code=status.HTTP_201_CREATED)
async def create_enrollment(
    organization_id: UUID, payload: EnrollmentCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Matrícula segura: la oferta y estudiante deben pertenecer al MISMO tenant."""
    try:
        async with engine.begin() as conn:
            actor = await _require_scope(conn, auth_id, organization_id, manage=True)
            available = (await conn.execute(text("""
                SELECT 1 FROM app.course_offerings off
                JOIN app.courses c ON c.id=off.course_id AND c.organization_id=off.organization_id
                JOIN app.students s ON s.organization_id=off.organization_id AND s.id=:student_id
                JOIN app.organization_memberships m ON m.id=s.membership_id
                  AND m.organization_id=s.organization_id AND m.status='active'
                JOIN app.users u ON u.id=m.user_id AND u.status='active'
                WHERE off.organization_id=:organization_id AND off.id=:offering_id
                  AND off.status='open' AND c.status='published' AND s.status='active'
            """), {"organization_id": organization_id, "offering_id": payload.offering_id,
                    "student_id": payload.student_id})).first()
            if not available:
                raise HTTPException(status_code=422,
                    detail="La oferta no está abierta o el estudiante no pertenece a la institución")
            enrollment_id = (await conn.execute(text("""
                INSERT INTO app.enrollments
                  (organization_id, offering_id, student_id, status)
                VALUES (:organization_id, :offering_id, :student_id, 'active')
                RETURNING id
            """), {"organization_id": organization_id, **payload.model_dump()})).scalar_one()
            await conn.execute(text("""
                INSERT INTO app.audit_logs
                  (organization_id, actor_id, action, resource, resource_id)
                VALUES (:organization_id, :actor, 'create', 'enrollments', :enrollment_id)
            """), {"organization_id": organization_id, "actor": actor,
                    "enrollment_id": enrollment_id})
        return {"id": str(enrollment_id), "message": "Matrícula registrada"}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="El estudiante ya está matriculado en esta oferta") from exc
    except SQLAlchemyError as exc:
        raise _db_error(exc, "No se pudo registrar la matrícula en PostgreSQL") from exc
