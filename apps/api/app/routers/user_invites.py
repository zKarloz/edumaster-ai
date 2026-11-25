"""Invitación individual e importación masiva controlada por institución.

La identidad se crea en Supabase Auth (correo de invitación), luego en `app`.
No se crean contraseñas; una importación parcial reporta cada fila.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.config import Settings, get_settings
from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.institutional_users import (
    _lock_organization,
    _provision_academic_profile,
    _role_id,
)
from app.services.user_invites import (
    GLOBAL_ROLES,
    INSTITUTION_ROLES,
    ImportBatch,
    InviteItem,
    invite_auth_user,
    parse_csv_preview,
)

router = APIRouter(prefix="/api/v1/provisioning/organizations", tags=["user-provisioning"])
logger = logging.getLogger(__name__)


class PreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    csv_text: str = Field(min_length=1, max_length=96_000)


async def _authorize(conn: AsyncConnection, auth_id: UUID, organization_id: UUID) -> tuple[UUID, bool]:
    """Superadmin global o administrador activo DEL tenant solicitado."""

    user = (await conn.execute(text("""
        SELECT u.id, EXISTS(
            SELECT 1 FROM app.global_role_assignments gr
            JOIN app.roles r ON r.id=gr.role_id
            WHERE gr.user_id=u.id AND r.code='superadmin' AND r.scope='global'
        ) AS superadmin
        FROM app.users u WHERE u.auth_user_id=:auth AND u.status='active'
    """), {"auth": auth_id})).mappings().first()
    if not user:
        raise HTTPException(status_code=403, detail="Administración de usuarios no autorizada")
    if user["superadmin"]:
        return user["id"], True
    allowed = (await conn.execute(text("""
        SELECT 1 FROM app.organization_memberships m
        JOIN app.membership_roles mr ON mr.membership_id=m.id
        JOIN app.roles r ON r.id=mr.role_id
        JOIN app.organizations o ON o.id=m.organization_id
        WHERE m.user_id=:user_id AND m.organization_id=:organization_id
          AND m.status='active' AND o.status='active'
          AND r.scope='organization' AND r.code='institution_admin'
    """), {"user_id": user["id"], "organization_id": organization_id})).first()
    if not allowed:
        raise HTTPException(status_code=403, detail="Administración de usuarios no autorizada")
    return user["id"], False


async def _preflight(conn: AsyncConnection, email: str, organization_id: UUID) -> None:
    """No enviar invitaciones a identidades ya existentes o instituciones inactivas."""

    await _lock_organization(conn, organization_id)
    existing = (await conn.execute(text("""
        SELECT 1 FROM auth.users WHERE lower(email)=:email
        UNION ALL SELECT 1 FROM app.users WHERE email_normalized=:email
        LIMIT 1
    """), {"email": email})).first()
    if existing:
        raise HTTPException(status_code=409, detail="El correo ya existe; usa Incorporar usuario existente o revisa la invitación anterior")


async def _attach(conn: AsyncConnection, org: UUID, actor: UUID, new_id: UUID, item: InviteItem) -> UUID:
    """Aprovisiona app.users, membresía, rol y perfil académico de forma atómica."""

    await _lock_organization(conn, org)
    await conn.execute(text("""
        INSERT INTO app.users (auth_user_id, email_normalized, full_name)
        VALUES (:auth_user, :email, :name)
        ON CONFLICT (auth_user_id) DO NOTHING
    """), {"auth_user": new_id, "email": item.email, "name": item.full_name})
    internal_id = (await conn.execute(text("""
        SELECT id, status, email_normalized FROM app.users WHERE auth_user_id=:auth_user
    """), {"auth_user": new_id})).mappings().first()
    if not internal_id or internal_id["status"] != "active" or internal_id["email_normalized"] != item.email:
        raise HTTPException(status_code=409, detail="No se pudo vincular la identidad con el perfil institucional")
    member_id = (await conn.execute(text("""
        INSERT INTO app.organization_memberships (organization_id, user_id, status, joined_at)
        VALUES (:org, :user_id, 'active', now())
        ON CONFLICT (organization_id, user_id) DO NOTHING
        RETURNING id
    """), {"org": org, "user_id": internal_id["id"]})).scalar_one_or_none()
    if member_id is None:
        raise HTTPException(status_code=409, detail="La cuenta ya pertenece a la institución")
    role_id = await _role_id(conn, item.role)
    await conn.execute(text("""
        INSERT INTO app.membership_roles (membership_id, role_id, granted_by)
        VALUES (:member, :role, :actor)
    """), {"member": member_id, "role": role_id, "actor": actor})
    await _provision_academic_profile(conn, org, member_id, item.role)
    await conn.execute(text("""
        INSERT INTO app.audit_logs (organization_id, actor_id, action, resource, resource_id, metadata)
        VALUES (:org, :actor, 'invite', 'organization_memberships', :member,
                jsonb_build_object('role', CAST(:role AS text), 'delivery', 'supabase_auth'))
    """), {"org": org, "actor": actor, "member": member_id, "role": item.role})
    return member_id


async def _invite_one(
    engine: AsyncEngine, settings: Settings, auth_id: UUID, organization_id: UUID, item: InviteItem,
) -> dict:
    # La primera transacción nunca ejecuta efectos externos; valida alcance y duplicados.
    async with engine.begin() as conn:
        _, global_admin = await _authorize(conn, auth_id, organization_id)
        if item.role not in (GLOBAL_ROLES if global_admin else INSTITUTION_ROLES):
            raise HTTPException(status_code=403, detail="No puedes invitar a una cuenta con ese rol")
        await _preflight(conn, item.email, organization_id)
    # Invitar a través de GoTrue. La operación externa no puede revertirse con ROLLBACK.
    auth_user_id = await invite_auth_user(settings, item)
    try:
        async with engine.begin() as conn:
            actor, global_admin = await _authorize(conn, auth_id, organization_id)
            if item.role not in (GLOBAL_ROLES if global_admin else INSTITUTION_ROLES):
                raise HTTPException(status_code=403, detail="Rol no autorizado")
            member_id = await _attach(conn, organization_id, actor, auth_user_id, item)
    except (SQLAlchemyError, HTTPException) as exc:
        logger.exception("Invitación enviada pero aprovisionamiento institucional incompleto")
        raise HTTPException(status_code=503, detail=(
            "La invitación pudo enviarse pero el perfil no se vinculó. "
            "No repitas el correo: solicita una revisión administrativa."
        )) from exc
    return {"email": item.email, "role": item.role, "membership_id": str(member_id), "status": "invited"}


@router.get("/{organization_id}/members")
async def list_invited_members(
    organization_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Directorio institucional acotado; el superadmin ve también cuentas comunes."""

    try:
        async with engine.connect() as conn:
            await _authorize(conn, auth_id, organization_id)
            rows = (await conn.execute(text("""
                SELECT u.id::text AS user_id, u.full_name, u.email_normalized AS email,
                       CASE WHEN au.email_confirmed_at IS NULL AND m.status='active'
                            THEN 'invited' ELSE m.status END AS status,
                       COALESCE(array_agg(r.code ORDER BY r.code)
                            FILTER (WHERE r.code IS NOT NULL), ARRAY[]::text[]) AS roles
                FROM app.organization_memberships m
                JOIN app.users u ON u.id=m.user_id
                JOIN auth.users au ON au.id=u.auth_user_id
                LEFT JOIN app.membership_roles mr ON mr.membership_id=m.id
                LEFT JOIN app.roles r ON r.id=mr.role_id AND r.scope='organization'
                WHERE m.organization_id=:org
                GROUP BY u.id, u.full_name, u.email_normalized, m.status, au.email_confirmed_at
                ORDER BY u.full_name, u.email_normalized
                LIMIT 500
            """), {"org": organization_id})).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except SQLAlchemyError as exc:
        logger.exception("No se pudo consultar el directorio de invitaciones")
        raise HTTPException(status_code=503, detail="No se pudo consultar los miembros") from exc


@router.post("/{organization_id}/preview")
async def preview_import(
    organization_id: UUID, payload: PreviewRequest,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Vista previa, sin enviar correos ni modificar datos."""

    async with engine.connect() as conn:
        _, global_admin = await _authorize(conn, auth_id, organization_id)
    return parse_csv_preview(payload.csv_text, GLOBAL_ROLES if global_admin else INSTITUTION_ROLES)


@router.post("/{organization_id}/invite", status_code=status.HTTP_201_CREATED)
async def invite_user(
    organization_id: UUID, payload: InviteItem,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Invita un usuario; si ya existe se usa la gestión de miembros existentes."""

    try:
        return await _invite_one(engine, settings, auth_id, organization_id, payload)
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="La invitación ya está registrada") from exc
    except SQLAlchemyError as exc:
        logger.exception("Fallo SQL invitando usuario")
        raise HTTPException(status_code=503, detail="No se pudo procesar la invitación") from exc


@router.post("/{organization_id}/import")
async def import_users(
    organization_id: UUID, payload: ImportBatch,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Procesa hasta veinte invitaciones con resultado por fila para reintentos."""

    if not payload.confirmed:
        raise HTTPException(status_code=422, detail="Confirma la importación antes de enviar invitaciones")
    emails = [item.email for item in payload.rows]
    if len(emails) != len(set(emails)):
        raise HTTPException(status_code=422, detail="El lote contiene correos duplicados")
    # Autorizar todo el lote ANTES de llamar a Supabase Auth.
    async with engine.connect() as conn:
        _, global_admin = await _authorize(conn, auth_id, organization_id)
        if any(item.role not in (GLOBAL_ROLES if global_admin else INSTITUTION_ROLES) for item in payload.rows):
            raise HTTPException(status_code=403, detail="El lote contiene un rol no autorizado")
    results = []
    for row in payload.rows:
        try:
            record = await _invite_one(engine, settings, auth_id, organization_id, row)
            results.append({"email": row.email, "status": "invited", "membership_id": record["membership_id"]})
        except HTTPException as exc:
            # No enviamos mensajes internos de Supabase ni códigos de Auth al navegador.
            results.append({"email": row.email, "status": "error", "message": str(exc.detail)})
        except SQLAlchemyError:
            logger.exception("Error SQL en lote de invitaciones")
            results.append({"email": row.email, "status": "error", "message": "Error temporal de base de datos"})
    return {"items": results, "invited": sum(r["status"] == "invited" for r in results), "errors": sum(r["status"] == "error" for r in results)}
