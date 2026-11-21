"""Administración GLOBAL de administradores institucionales.

Solo el superadministrador puede asignar o revocar este rol. Las identidades se
crean previamente en Supabase Auth: nunca se manipulan contraseñas desde aquí.
Todas las mutaciones bloquean la fila de la institución, de forma que no sea
posible revocar concurrentemente a sus dos últimos administradores.
"""
import logging
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.organizations import _require_superadmin

router = APIRouter(prefix="/api/v1/admin/institution-admins", tags=["user-administration"])
logger = logging.getLogger(__name__)


class AdminAssignment(BaseModel):
    """Solo se recibe institución, email y motivo; el rol NO es seleccionable."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    organization_id: UUID
    email: str = Field(min_length=5, max_length=254)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Introduce un correo electrónico válido")
        return value


# Solo asignaciones existentes: no exponemos el directorio completo de Auth.
LIST_ADMINS_SQL = text("""
    SELECT m.id::text AS membership_id, o.id::text AS organization_id,
           o.name AS organization_name, u.id::text AS user_id,
           u.full_name, u.email_normalized AS email,
           CASE WHEN u.status = 'active' THEN m.status ELSE u.status END AS status,
           mr.granted_at
    FROM app.organization_memberships m
    JOIN app.organizations o ON o.id = m.organization_id
    JOIN app.users u ON u.id = m.user_id
    JOIN app.membership_roles mr ON mr.membership_id = m.id
    JOIN app.roles r ON r.id = mr.role_id
    WHERE r.code = 'institution_admin' AND r.scope = 'organization'
    ORDER BY o.name, u.full_name
    LIMIT 500
""")


@router.get("")
async def list_institution_admins(
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Lista solo a administradores institucionales; requiere superadmin."""
    try:
        async with engine.connect() as conn:
            await _require_superadmin(conn, auth_id)
            rows = (await conn.execute(LIST_ADMINS_SQL)).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except SQLAlchemyError as exc:
        logger.exception("Error consultando administradores institucionales")
        raise HTTPException(status_code=503, detail="No se pudo consultar el directorio") from exc


async def _lock_active_organization(conn: AsyncConnection, organization_id: UUID) -> None:
    """Serializa los cambios de administradores por institución."""
    row = (await conn.execute(text("""
        SELECT id FROM app.organizations
        WHERE id = :organization_id AND status = 'active'
        FOR UPDATE
    """), {"organization_id": organization_id})).first()
    if not row:
        raise HTTPException(status_code=404, detail="Institución no disponible")


@router.post("", status_code=status.HTTP_201_CREATED)
async def assign_institution_admin(
    payload: AdminAssignment,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Vincula una cuenta Auth confirmada y agrega el rol en una transacción."""
    try:
        async with engine.begin() as conn:
            actor = await _require_superadmin(conn, auth_id)
            await _lock_active_organization(conn, payload.organization_id)

            auth_user = (await conn.execute(text("""
                SELECT id, email, email_confirmed_at, raw_user_meta_data
                FROM auth.users
                WHERE lower(email) = :email
            """), {"email": payload.email})).mappings().first()
            if not auth_user or auth_user["email_confirmed_at"] is None:
                raise HTTPException(status_code=422, detail="La cuenta debe existir en Supabase Auth y tener correo confirmado")

            # Nombre de presentación seguro para usuarios nuevos, sin sobrescribir
            # nombres existentes. Los perfiles reales podrán completarse después.
            metadata = auth_user["raw_user_meta_data"] if isinstance(auth_user["raw_user_meta_data"], dict) else {}
            raw_name = metadata.get("full_name") or metadata.get("name") or ""
            display_name = str(raw_name).strip()[:180] if raw_name and str(raw_name).strip() else payload.email.split("@")[0][:180]

            await conn.execute(text("""
                INSERT INTO app.users (auth_user_id, email_normalized, full_name)
                VALUES (:auth_user_id, :email, :full_name)
                ON CONFLICT (auth_user_id) DO UPDATE
                SET email_normalized = EXCLUDED.email_normalized
            """), {"auth_user_id": auth_user["id"], "email": payload.email, "full_name": display_name})
            user = (await conn.execute(text("""
                SELECT id, status FROM app.users WHERE auth_user_id = :auth_user_id
            """), {"auth_user_id": auth_user["id"]})).mappings().first()
            if not user or user["status"] != "active":
                raise HTTPException(status_code=409, detail="El usuario EduMaster.ai no está activo")

            role_id = (await conn.execute(text("""
                SELECT id FROM app.roles
                WHERE code = 'institution_admin' AND scope = 'organization'
            """))).scalar_one_or_none()
            if role_id is None:
                raise HTTPException(status_code=503, detail="No está configurado el rol institucional")

            membership = (await conn.execute(text("""
                SELECT id, status FROM app.organization_memberships
                WHERE organization_id = :organization_id AND user_id = :user_id
            """), {"organization_id": payload.organization_id, "user_id": user["id"]})).mappings().first()
            if membership and membership["status"] == "suspended":
                raise HTTPException(status_code=409, detail="La membresía está suspendida; requiere revisión antes de asignarle roles")

            if membership:
                membership_id = membership["id"]
                already = (await conn.execute(text("""
                    SELECT 1 FROM app.membership_roles
                    WHERE membership_id = :membership_id AND role_id = :role_id
                """), {"membership_id": membership_id, "role_id": role_id})).first()
                if already and membership["status"] == "active":
                    raise HTTPException(status_code=409, detail="La cuenta ya es administradora de esta institución")
                await conn.execute(text("""
                    UPDATE app.organization_memberships
                    SET status = 'active', joined_at = COALESCE(joined_at, now())
                    WHERE id = :membership_id
                """), {"membership_id": membership_id})
            else:
                membership_id = (await conn.execute(text("""
                    INSERT INTO app.organization_memberships
                        (organization_id, user_id, status, joined_at)
                    VALUES (:organization_id, :user_id, 'active', now())
                    RETURNING id
                """), {"organization_id": payload.organization_id, "user_id": user["id"]})).scalar_one()

            await conn.execute(text("""
                INSERT INTO app.membership_roles (membership_id, role_id, granted_by)
                VALUES (:membership_id, :role_id, :actor)
                ON CONFLICT (membership_id, role_id) DO UPDATE
                SET granted_by = EXCLUDED.granted_by, granted_at = now()
            """), {"membership_id": membership_id, "role_id": role_id, "actor": actor})
            await conn.execute(text("""
                INSERT INTO app.audit_logs
                    (organization_id, actor_id, action, resource, resource_id, metadata)
                VALUES (:organization_id, :actor, 'grant', 'membership_roles', :membership_id,
                    jsonb_build_object('role', 'institution_admin',
                                       'reason', CAST(:reason AS text)))
            """), {"organization_id": payload.organization_id, "actor": actor,
                    "membership_id": membership_id, "reason": payload.reason or ""})
        return {"membership_id": str(membership_id), "message": "Administrador institucional asignado"}
    except IntegrityError as exc:
        logger.warning("Conflicto asignando administrador institucional", exc_info=True)
        raise HTTPException(status_code=409, detail="No se pudo asignar la cuenta por un conflicto de datos") from exc
    except SQLAlchemyError as exc:
        logger.exception("Error SQL asignando administrador institucional")
        raise HTTPException(status_code=503, detail="Error de base de datos al asignar administrador") from exc


@router.delete("/{membership_id}")
async def revoke_institution_admin(
    membership_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Revoca solo el rol de admin. Conserva otros roles y su identidad global."""
    try:
        async with engine.begin() as conn:
            actor = await _require_superadmin(conn, auth_id)
            target = (await conn.execute(text("""
                SELECT organization_id FROM app.organization_memberships WHERE id = :membership_id
            """), {"membership_id": membership_id})).mappings().first()
            if not target:
                raise HTTPException(status_code=404, detail="Asignación no encontrada")
            organization_id = target["organization_id"]
            await _lock_active_organization(conn, organization_id)

            # Revalidamos todo bajo el bloqueo de la institución para evitar
            # que dos revocaciones simultáneas dejen cero administradores.
            row = (await conn.execute(text("""
                SELECT m.id FROM app.organization_memberships m
                JOIN app.membership_roles mr ON mr.membership_id = m.id
                JOIN app.roles r ON r.id = mr.role_id
                WHERE m.id = :membership_id AND m.organization_id = :organization_id
                  AND m.status = 'active'
                  AND r.code = 'institution_admin' AND r.scope = 'organization'
            """), {"membership_id": membership_id, "organization_id": organization_id})).first()
            if not row:
                raise HTTPException(status_code=404, detail="Asignación activa no encontrada")

            count = (await conn.execute(text("""
                SELECT COUNT(*) FROM app.organization_memberships m
                JOIN app.membership_roles mr ON mr.membership_id = m.id
                JOIN app.roles r ON r.id = mr.role_id
                JOIN app.users u ON u.id = m.user_id
                WHERE m.organization_id = :organization_id AND m.status = 'active'
                  AND u.status = 'active'
                  AND r.code = 'institution_admin' AND r.scope = 'organization'
            """), {"organization_id": organization_id})).scalar_one()
            if count <= 1:
                raise HTTPException(status_code=409, detail="No puedes revocar al último administrador activo de la institución")

            await conn.execute(text("""
                DELETE FROM app.membership_roles
                WHERE membership_id = :membership_id AND role_id = (
                    SELECT id FROM app.roles WHERE code='institution_admin' AND scope='organization'
                )
            """), {"membership_id": membership_id})
            # Si conserva otros roles, no se revoca su membresía institucional.
            await conn.execute(text("""
                UPDATE app.organization_memberships
                SET status='revoked'
                WHERE id=:membership_id
                  AND NOT EXISTS (
                    SELECT 1 FROM app.membership_roles WHERE membership_id=:membership_id
                  )
            """), {"membership_id": membership_id})
            await conn.execute(text("""
                INSERT INTO app.audit_logs
                    (organization_id, actor_id, action, resource, resource_id, metadata)
                VALUES (:organization_id, :actor, 'revoke', 'membership_roles', :membership_id,
                        jsonb_build_object('role', 'institution_admin'))
            """), {"organization_id": organization_id, "actor": actor,
                    "membership_id": membership_id})
        return {"message": "Rol de administrador institucional revocado"}
    except SQLAlchemyError as exc:
        logger.exception("Error SQL revocando administrador institucional")
        raise HTTPException(status_code=503, detail="Error de base de datos al revocar administrador") from exc
