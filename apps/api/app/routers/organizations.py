"""API de identidad, instituciones y mapa geográfico de EduMaster.ai.

Las consultas siempre comprueban identidad/alcance en el backend. Solo un
superadministrador activo puede crear o editar instituciones. No se expone
el esquema `app` mediante la API automática de Supabase.
"""
import logging
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id

router = APIRouter(prefix="/api/v1", tags=["identity & organizations"])
logger = logging.getLogger(__name__)


class OrganizationFields(BaseModel):
    """Datos editables y coordenadas de la sede principal de una institución."""
    model_config = ConfigDict(str_strip_whitespace=True, allow_inf_nan=False)

    name: str = Field(min_length=3, max_length=180)
    timezone: str = Field(min_length=3, max_length=80)
    country_code: str = Field(min_length=2, max_length=2, pattern=r"^[A-Z]{2}$")
    city: str = Field(min_length=2, max_length=120)
    address: str | None = Field(default=None, max_length=240)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

    @field_validator("country_code", mode="before")
    @classmethod
    def normalize_country(cls, value: object) -> object:
        """Acepta el código ISO de dos letras y lo guarda en mayúsculas."""
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("timezone")
    @classmethod
    def check_timezone(cls, value: str) -> str:
        """Previene zonas horarias inventadas al operar en varios países."""
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("La zona horaria IANA no es válida") from exc
        return value


class OrganizationCreate(OrganizationFields):
    # Identificador estable de alcance global: `pe-unmsm`, `co-unal`, etc.
    # Las filas anteriores se preservan; esta validación aplica SOLO a altas.
    code: str = Field(
        min_length=5, max_length=40,
        pattern=r"^[a-z]{2}-[a-z0-9][a-z0-9_-]{0,35}[a-z0-9]$",
    )

    @model_validator(mode="after")
    def code_matches_country(self) -> "OrganizationCreate":
        """Evita crear sedes peruanas con un identificador de otro país."""
        if not self.code.startswith(f"{self.country_code.lower()}-"):
            raise ValueError(
                f"El código institucional debe comenzar por {self.country_code.lower()}- "
                "para coincidir con el país seleccionado"
            )
        return self


async def _require_superadmin(conn: AsyncConnection, auth_id: UUID) -> UUID:
    """Obtiene el ID interno del superadmin activo desde tablas administradas."""
    row = (await conn.execute(text("""
        SELECT u.id FROM app.users u
        WHERE u.auth_user_id = :auth_id AND u.status = 'active'
          AND EXISTS (
            SELECT 1 FROM app.global_role_assignments gra
            JOIN app.roles r ON r.id = gra.role_id
            WHERE gra.user_id = u.id AND r.code = 'superadmin' AND r.scope = 'global'
          )
    """), {"auth_id": auth_id})).first()
    if not row:
        raise HTTPException(status_code=403, detail="Se necesita el rol superadmin para esta operación")
    return row[0]


@router.get("/me")
async def my_profile(
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Comprueba aprovisionamiento y devuelve ámbitos de autorización."""
    user_sql = text("""
        SELECT id, full_name, email_normalized, status
        FROM app.users WHERE auth_user_id = :auth_id
    """)
    global_sql = text("""
        SELECT r.code FROM app.global_role_assignments gra
        JOIN app.roles r ON r.id = gra.role_id
        WHERE gra.user_id = :user_id AND r.scope = 'global'
        ORDER BY r.code
    """)
    memberships_sql = text("""
        SELECT o.id::text AS organization_id, o.name AS organization_name,
               COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL),
                        ARRAY[]::text[]) AS roles
        FROM app.organization_memberships m
        JOIN app.organizations o ON o.id = m.organization_id
        LEFT JOIN app.membership_roles mr ON mr.membership_id = m.id
        LEFT JOIN app.roles r ON r.id = mr.role_id AND r.scope = 'organization'
        WHERE m.user_id = :user_id AND m.status = 'active' AND o.status = 'active'
        GROUP BY o.id, o.name ORDER BY o.name
    """)
    async with engine.connect() as conn:
        user = (await conn.execute(user_sql, {"auth_id": auth_id})).mappings().first()
        if not user or user["status"] != "active":
            raise HTTPException(status_code=403, detail="Cuenta pendiente de habilitación en EduMaster.ai")
        roles = (await conn.execute(global_sql, {"user_id": user["id"]})).scalars().all()
        memberships = (await conn.execute(memberships_sql, {"user_id": user["id"]})).mappings().all()
    if not roles and not memberships:
        raise HTTPException(status_code=403, detail="No tienes roles ni membresías activas en EduMaster.ai")
    return {
        "user": {"name": user["full_name"], "email": user["email_normalized"]},
        "global_roles": list(roles),
        "memberships": [dict(item) for item in memberships],
    }


# Los totales académicos solo se entregan a gestores de la institución o superadmin.
ORGANIZATION_LIST_SQL = text("""
    SELECT o.id::text AS id, o.code, o.name, o.timezone, o.status,
           loc.country_code, loc.city, loc.address,
           loc.latitude, loc.longitude,
           CASE WHEN access.can_view_counts THEN (
               SELECT count(*) FROM app.enrollments e
               WHERE e.organization_id = o.id
           ) END AS enrollment_count,
           CASE WHEN access.can_view_counts THEN (
               SELECT count(*) FROM app.students s
               WHERE s.organization_id = o.id
           ) END AS student_count
    FROM app.organizations o
    CROSS JOIN LATERAL (
        SELECT EXISTS (
            SELECT 1 FROM app.users u
            WHERE u.auth_user_id = :auth_id AND u.status = 'active'
              AND (
                EXISTS (
                    SELECT 1 FROM app.global_role_assignments gra
                    JOIN app.roles r ON r.id = gra.role_id
                    WHERE gra.user_id = u.id AND r.code = 'superadmin' AND r.scope = 'global'
                ) OR EXISTS (
                    SELECT 1 FROM app.organization_memberships m
                    JOIN app.membership_roles mr ON mr.membership_id = m.id
                    JOIN app.roles r ON r.id = mr.role_id
                    WHERE m.user_id = u.id AND m.organization_id = o.id AND m.status = 'active'
                      AND r.scope = 'organization' AND r.code IN ('institution_admin', 'coordinator')
                )
              )
        ) AS can_view_counts
    ) access
    LEFT JOIN app.organization_locations loc ON loc.organization_id = o.id
    WHERE o.status = 'active'
      AND EXISTS (
        SELECT 1 FROM app.users u
        WHERE u.auth_user_id = :auth_id AND u.status = 'active'
          AND (
            EXISTS (
              SELECT 1 FROM app.global_role_assignments gra
              JOIN app.roles r ON r.id = gra.role_id
              WHERE gra.user_id = u.id AND r.code = 'superadmin' AND r.scope = 'global'
            )
            OR EXISTS (
              SELECT 1 FROM app.organization_memberships m
              WHERE m.user_id = u.id AND m.organization_id = o.id AND m.status = 'active'
            )
          )
      )
    ORDER BY o.name
    LIMIT 500
""")


@router.get("/organizations")
async def my_organizations(
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Superadmin ve instituciones activas; demás usuarios, solo las propias."""
    async with engine.connect() as conn:
        rows = (await conn.execute(ORGANIZATION_LIST_SQL, {"auth_id": auth_id})).mappings().all()
    return {"items": [dict(row) for row in rows]}


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Crea institución y geolocalización atómicamente; registra auditoría."""
    try:
        async with engine.begin() as conn:
            actor = await _require_superadmin(conn, auth_id)
            row = (await conn.execute(text("""
                INSERT INTO app.organizations (code, name, timezone)
                VALUES (:code, :name, :timezone)
                RETURNING id
            """), payload.model_dump(include={"code", "name", "timezone"}))).first()
            organization_id = row[0]
            data = payload.model_dump(exclude={"code", "name", "timezone"})
            await conn.execute(text("""
                INSERT INTO app.organization_locations
                  (organization_id, country_code, city, address, latitude, longitude)
                VALUES (:organization_id, :country_code, :city, :address, :latitude, :longitude)
            """), {**data, "organization_id": organization_id})
            await conn.execute(text("""
                INSERT INTO app.audit_logs (organization_id, actor_id, action, resource, resource_id,
                                            metadata)
                VALUES (:organization_id, :actor, 'create', 'organizations', :organization_id,
                        -- asyncpg necesita un tipo SQL explícito al construir un JSONB.
                        jsonb_build_object('country_code', CAST(:country_code AS text)))
            """), {"organization_id": organization_id, "actor": actor, "country_code": payload.country_code})
        return {"id": str(organization_id), "message": "Institución registrada"}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="El código de institución ya existe o los datos son inválidos") from exc
    except SQLAlchemyError as exc:
        # Devolvemos HTTP controlado para que CORS no oculte errores de PostgreSQL.
        # La transacción `engine.begin()` ya se revierte al salir con excepción.
        logger.exception("Error SQL al registrar institución")
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar la institución por un error de base de datos. Revisa la terminal de FastAPI.",
        ) from exc


@router.put("/organizations/{organization_id}")
async def update_organization(
    organization_id: UUID,
    payload: OrganizationFields,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Edita una institución existente. No permite transferir la propiedad de datos."""
    async with engine.begin() as conn:
        actor = await _require_superadmin(conn, auth_id)
        changed = (await conn.execute(text("""
            UPDATE app.organizations
            SET name = :name, timezone = :timezone
            WHERE id = :organization_id AND status = 'active'
            RETURNING id
        """), {"organization_id": organization_id, "name": payload.name, "timezone": payload.timezone})).first()
        if not changed:
            raise HTTPException(status_code=404, detail="Institución no disponible")
        await conn.execute(text("""
            INSERT INTO app.organization_locations
              (organization_id, country_code, city, address, latitude, longitude)
            VALUES (:organization_id, :country_code, :city, :address, :latitude, :longitude)
            ON CONFLICT (organization_id) DO UPDATE SET
              country_code = EXCLUDED.country_code,
              city = EXCLUDED.city,
              address = EXCLUDED.address,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude
        """), {**payload.model_dump(exclude={"name", "timezone"}), "organization_id": organization_id})
        await conn.execute(text("""
            INSERT INTO app.audit_logs (organization_id, actor_id, action, resource, resource_id)
            VALUES (:organization_id, :actor, 'update', 'organizations', :organization_id)
        """), {"organization_id": organization_id, "actor": actor})
    return {"id": str(organization_id), "message": "Institución actualizada"}


@router.get("/organizations/{organization_id}/courses")
async def my_tenant_courses(
    organization_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Solo permite consultar cursos publicados de instituciones autorizadas."""
    access_sql = text("""
        SELECT 1 FROM app.organizations o
        WHERE o.id = :org_id AND o.status = 'active'
          AND EXISTS (
            SELECT 1 FROM app.users u
            WHERE u.auth_user_id = :auth_id AND u.status = 'active'
              AND (
                EXISTS (
                  SELECT 1 FROM app.global_role_assignments gra
                  JOIN app.roles r ON r.id = gra.role_id
                  WHERE gra.user_id = u.id AND r.scope = 'global' AND r.code = 'superadmin'
                )
                OR EXISTS (
                  SELECT 1 FROM app.organization_memberships m
                  WHERE m.user_id = u.id AND m.organization_id = o.id AND m.status = 'active'
                )
              )
          )
    """)
    courses_sql = text("""
        SELECT id::text AS id, code, title, status FROM app.courses
        WHERE organization_id = :org_id AND status = 'published'
        ORDER BY code LIMIT :limit
    """)
    async with engine.connect() as conn:
        allowed = (await conn.execute(access_sql, {"auth_id": auth_id, "org_id": organization_id})).first()
        if not allowed:
            raise HTTPException(status_code=404, detail="Institución no disponible")
        rows = (await conn.execute(courses_sql, {"org_id": organization_id, "limit": limit})).mappings().all()
    return {"items": [dict(row) for row in rows]}
