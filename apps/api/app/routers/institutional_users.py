"""Gestión de miembros por el administrador de SU institución.

La identidad existe primero en Supabase Auth. Esta API únicamente asigna roles
institucionales permitidos; nunca crea contraseñas, privilegios globales ni
administradores. Todas las mutaciones se validan dentro de una transacción.
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

router = APIRouter(prefix="/api/v1/institutional/organizations", tags=["institutional-users"])
logger = logging.getLogger(__name__)

# Roles de alcance institucional delegables. Auditor y administrador institucional
# quedan reservados a procesos globales; el rol ML no da acceso automático a datos.
DELEGABLE_ROLES = frozenset({"coordinator", "instructor", "student", "analyst", "ml_engineer"})


class MemberAssignment(BaseModel):
    """Alta de una cuenta existente de Auth, con primer rol institucional."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    email: str = Field(min_length=5, max_length=254)
    full_name: str = Field(min_length=3, max_length=180)
    role: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Correo no válido")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in DELEGABLE_ROLES:
            raise ValueError("El rol solicitado no puede asignarse desde esta institución")
        return value


class RoleAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in DELEGABLE_ROLES:
            raise ValueError("Rol no delegable")
        return value


class MembershipStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in ("active", "suspended"):
            raise ValueError("Solo se permite activar o suspender una membresía")
        return value


async def _require_institution_admin(conn: AsyncConnection, auth_id: UUID, organization_id: UUID) -> UUID:
    """Autorización exclusiva del admin institucional activo de ese tenant."""
    row = (await conn.execute(text("""
        SELECT u.id FROM app.users u
        JOIN app.organization_memberships m ON m.user_id=u.id
          AND m.organization_id=:organization_id AND m.status='active'
        JOIN app.organizations o ON o.id=m.organization_id AND o.status='active'
        JOIN app.membership_roles mr ON mr.membership_id=m.id
        JOIN app.roles r ON r.id=mr.role_id
        WHERE u.auth_user_id=:auth_id AND u.status='active'
          AND r.code='institution_admin' AND r.scope='organization'
    """), {"auth_id": auth_id, "organization_id": organization_id})).first()
    if row is None:
        # No revelar si existe otra institución ni si su usuario es administrador.
        raise HTTPException(status_code=403, detail="Se requiere administración institucional autorizada")
    return row[0]


async def _lock_organization(conn: AsyncConnection, organization_id: UUID) -> None:
    """Serializa cambios de membresía realizados por la administración local."""
    row = (await conn.execute(text("""
        SELECT id FROM app.organizations WHERE id=:organization_id AND status='active' FOR UPDATE
    """), {"organization_id": organization_id})).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Institución no disponible")


async def _member_for_update(conn: AsyncConnection, organization_id: UUID, membership_id: UUID) -> dict:
    """Bloquea un miembro del tenant e impide tocar administradores o auditores."""
    member = (await conn.execute(text("""
        SELECT m.id, m.user_id, m.status, u.status AS user_status,
               (EXISTS (
                 SELECT 1 FROM app.membership_roles mr
                 JOIN app.roles r ON r.id=mr.role_id
                 WHERE mr.membership_id=m.id AND r.code IN ('institution_admin','auditor')
               ) OR EXISTS (
                 SELECT 1 FROM app.global_role_assignments gra
                 JOIN app.roles gr ON gr.id=gra.role_id
                 WHERE gra.user_id=u.id AND gr.code='superadmin'
               )) AS protected
        FROM app.organization_memberships m
        JOIN app.users u ON u.id=m.user_id
        WHERE m.id=:membership_id AND m.organization_id=:organization_id
        FOR UPDATE OF m
    """), {"organization_id": organization_id, "membership_id": membership_id})).mappings().first()
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado en esta institución")
    if member["protected"]:
        raise HTTPException(status_code=403, detail="Este usuario tiene roles reservados a la administración global")
    return dict(member)


async def _role_id(conn: AsyncConnection, code: str) -> UUID:
    role_id = (await conn.execute(text("""
        SELECT id FROM app.roles WHERE scope='organization' AND code=:role
    """), {"role": code})).scalar_one_or_none()
    if not role_id:
        raise HTTPException(status_code=503, detail="El catálogo de roles institucionales no está configurado")
    return role_id


async def _provision_academic_profile(conn: AsyncConnection, organization_id: UUID,
                                      membership_id: UUID, role: str) -> None:
    """Permite matricular estudiantes o asignar docentes sin altas duplicadas.

    Se conserva el identificador del perfil si el rol se reasigna más adelante.
    """
    if role == "student":
        await conn.execute(text("""
            INSERT INTO app.students (organization_id, membership_id, status)
            VALUES (:organization_id, :membership_id, 'active')
            ON CONFLICT (organization_id, membership_id)
            DO UPDATE SET status='active'
        """), {"organization_id": organization_id, "membership_id": membership_id})
    elif role == "instructor":
        await conn.execute(text("""
            INSERT INTO app.instructors (organization_id, membership_id, status)
            VALUES (:organization_id, :membership_id, 'active')
            ON CONFLICT (organization_id, membership_id)
            DO UPDATE SET status='active'
        """), {"organization_id": organization_id, "membership_id": membership_id})


async def _audit(conn: AsyncConnection, organization_id: UUID, actor: UUID,
                 membership_id: UUID, action: str, role: str = "") -> None:
    await conn.execute(text("""
        INSERT INTO app.audit_logs (organization_id, actor_id, action, resource, resource_id, metadata)
        VALUES (:organization_id, :actor, :action, 'organization_memberships', :membership_id,
                jsonb_build_object('role', CAST(:role AS text)))
    """), {"organization_id": organization_id, "actor": actor,
            "membership_id": membership_id, "action": action, "role": role})


@router.get("/{organization_id}/members")
async def list_members(
    organization_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Lista miembros del tenant, con sus roles; no expone usuarios de otros tenants."""
    try:
        async with engine.connect() as conn:
            actor = await _require_institution_admin(conn, auth_id, organization_id)
            rows = (await conn.execute(text("""
                SELECT m.id::text AS membership_id, m.organization_id::text AS organization_id,
                       u.id::text AS user_id,
                       u.full_name, u.email_normalized AS email, m.status,
                       (u.id=:actor) AS is_self,
                       (EXISTS (
                         SELECT 1 FROM app.global_role_assignments gra
                         JOIN app.roles gr ON gr.id=gra.role_id
                         WHERE gra.user_id=u.id AND gr.code='superadmin'
                       ) OR COALESCE(bool_or(r.code IN ('institution_admin','auditor')),false)) AS is_protected,
                       COALESCE(array_agg(r.code ORDER BY r.code)
                           FILTER (WHERE r.code IS NOT NULL), ARRAY[]::text[]) AS roles
                FROM app.organization_memberships m
                JOIN app.users u ON u.id=m.user_id
                LEFT JOIN app.membership_roles mr ON mr.membership_id=m.id
                LEFT JOIN app.roles r ON r.id=mr.role_id AND r.scope='organization'
                WHERE m.organization_id=:organization_id
                GROUP BY m.id, m.organization_id, u.id, u.full_name, u.email_normalized, m.status
                ORDER BY u.full_name, u.email_normalized
                LIMIT 500
            """), {"organization_id": organization_id, "actor": actor})).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except SQLAlchemyError as exc:
        logger.exception("Error listando usuarios de institución")
        raise HTTPException(status_code=503, detail="No se pudo consultar el directorio institucional") from exc


@router.post("/{organization_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    organization_id: UUID, payload: MemberAssignment,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Asigna primer rol a cuenta Auth confirmada; no reactiva suspendidos."""
    try:
        async with engine.begin() as conn:
            actor = await _require_institution_admin(conn, auth_id, organization_id)
            await _lock_organization(conn, organization_id)
            # La revocación global también bloquea la institución: repetir la
            # autorización bajo el mismo bloqueo evita cambios tras una baja.
            await _require_institution_admin(conn, auth_id, organization_id)
            auth_user = (await conn.execute(text("""
                SELECT id, email_confirmed_at FROM auth.users WHERE lower(email)=:email
            """), {"email": payload.email})).mappings().first()
            if not auth_user or auth_user["email_confirmed_at"] is None:
                raise HTTPException(status_code=422, detail="La cuenta debe existir en Supabase Auth y tener el correo confirmado")

            await conn.execute(text("""
                INSERT INTO app.users (auth_user_id, email_normalized, full_name)
                VALUES (:auth_user_id, :email, :full_name)
                ON CONFLICT (auth_user_id) DO NOTHING
            """), {"auth_user_id": auth_user["id"], "email": payload.email,
                    "full_name": payload.full_name})
            user = (await conn.execute(text("""
                SELECT id, status FROM app.users WHERE auth_user_id=:auth_user_id
            """), {"auth_user_id": auth_user["id"]})).mappings().first()
            if not user or user["status"] != "active":
                raise HTTPException(status_code=409, detail="Cuenta no activa en EduMaster.ai")
            if user["id"] == actor:
                raise HTTPException(status_code=403, detail="No puedes cambiar tus propios roles")
            # Impide administrar desde una institución una identidad global.
            global_privilege = (await conn.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM app.global_role_assignments gra
                    JOIN app.roles r ON r.id=gra.role_id
                    WHERE gra.user_id=:user_id AND r.code='superadmin'
                )
            """), {"user_id": user["id"]})).scalar_one()
            if global_privilege:
                raise HTTPException(status_code=403,
                    detail="Las cuentas con privilegios globales se gestionan centralmente")

            membership = (await conn.execute(text("""
                SELECT id, status FROM app.organization_memberships
                WHERE organization_id=:organization_id AND user_id=:user_id FOR UPDATE
            """), {"organization_id": organization_id, "user_id": user["id"]})).mappings().first()
            if membership and membership["status"] != "active":
                raise HTTPException(status_code=409, detail="La membresía requiere reactivación o revisión antes de asignar roles")
            if membership:
                membership_id = membership["id"]
                # Un administrador no puede alterar miembros con roles globalmente reservados.
                await _member_for_update(conn, organization_id, membership_id)
            else:
                membership_id = (await conn.execute(text("""
                    INSERT INTO app.organization_memberships
                        (organization_id, user_id, status, joined_at)
                    VALUES (:organization_id, :user_id, 'active', now()) RETURNING id
                """), {"organization_id": organization_id, "user_id": user["id"]})).scalar_one()
            role_id = await _role_id(conn, payload.role)
            present = (await conn.execute(text("""
                SELECT 1 FROM app.membership_roles
                WHERE membership_id=:membership_id AND role_id=:role_id
            """), {"membership_id": membership_id, "role_id": role_id})).first()
            if present:
                raise HTTPException(status_code=409, detail="La cuenta ya tiene ese rol en la institución")
            await conn.execute(text("""
                INSERT INTO app.membership_roles (membership_id, role_id, granted_by)
                VALUES (:membership_id, :role_id, :actor)
            """), {"membership_id": membership_id, "role_id": role_id, "actor": actor})
            await _provision_academic_profile(conn, organization_id, membership_id, payload.role)
            await _audit(conn, organization_id, actor, membership_id, "grant", payload.role)
        return {"membership_id": str(membership_id), "message": "Usuario vinculado a la institución"}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Conflicto de datos al registrar el usuario") from exc
    except SQLAlchemyError as exc:
        logger.exception("Error asignando usuario institucional")
        raise HTTPException(status_code=503, detail="No se pudo asignar el usuario") from exc


@router.post("/{organization_id}/members/{membership_id}/roles", status_code=200)
async def grant_member_role(
    organization_id: UUID, membership_id: UUID, payload: RoleAssignment,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Asigna roles adicionales permitidos a un miembro activo de su institución."""
    try:
        async with engine.begin() as conn:
            actor = await _require_institution_admin(conn, auth_id, organization_id)
            await _lock_organization(conn, organization_id)
            # La revocación global también bloquea la institución: repetir la
            # autorización bajo el mismo bloqueo evita cambios tras una baja.
            await _require_institution_admin(conn, auth_id, organization_id)
            member = await _member_for_update(conn, organization_id, membership_id)
            if member["user_id"] == actor:
                raise HTTPException(status_code=403, detail="No puedes modificar tus propios roles")
            if member["status"] != "active" or member["user_status"] != "active":
                raise HTTPException(status_code=409, detail="La membresía o cuenta no está activa")
            role_id = await _role_id(conn, payload.role)
            duplicate = (await conn.execute(text("""
                SELECT 1 FROM app.membership_roles WHERE membership_id=:membership_id AND role_id=:role_id
            """), {"membership_id": membership_id, "role_id": role_id})).first()
            if duplicate:
                raise HTTPException(status_code=409, detail="Este usuario ya tiene el rol seleccionado")
            await conn.execute(text("""
                INSERT INTO app.membership_roles (membership_id, role_id, granted_by)
                VALUES (:membership_id, :role_id, :actor)
            """), {"membership_id": membership_id, "role_id": role_id, "actor": actor})
            await _provision_academic_profile(conn, organization_id, membership_id, payload.role)
            await _audit(conn, organization_id, actor, membership_id, "grant", payload.role)
        return {"message": "Rol asignado"}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="No se pudo asignar el rol por un conflicto de datos") from exc
    except SQLAlchemyError as exc:
        logger.exception("Error SQL al asignar rol institucional")
        raise HTTPException(status_code=503, detail="No se pudo asignar el rol") from exc


@router.delete("/{organization_id}/members/{membership_id}/roles/{role}")
async def remove_member_role(
    organization_id: UUID, membership_id: UUID, role: str,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Revoca un rol sin eliminar la identidad ni las evidencias académicas."""
    if role not in DELEGABLE_ROLES:
        raise HTTPException(status_code=422, detail="No se puede revocar ese rol desde esta institución")
    try:
        async with engine.begin() as conn:
            actor = await _require_institution_admin(conn, auth_id, organization_id)
            await _lock_organization(conn, organization_id)
            # La revocación global también bloquea la institución: repetir la
            # autorización bajo el mismo bloqueo evita cambios tras una baja.
            await _require_institution_admin(conn, auth_id, organization_id)
            member = await _member_for_update(conn, organization_id, membership_id)
            if member["user_id"] == actor:
                raise HTTPException(status_code=403, detail="No puedes modificar tus propios roles")
            if member["status"] != "active":
                raise HTTPException(status_code=409, detail="La membresía no está activa")
            role_id = await _role_id(conn, role)
            has_role = (await conn.execute(text("""
                SELECT 1 FROM app.membership_roles WHERE membership_id=:membership_id AND role_id=:role_id
            """), {"membership_id": membership_id, "role_id": role_id})).first()
            if not has_role:
                raise HTTPException(status_code=404, detail="El usuario no tiene ese rol")
            # Una membresía activa sin roles seguiría apareciendo en /me.
            # Para retirar el último rol, primero suspender la membresía.
            other_roles = (await conn.execute(text("""
                SELECT COUNT(*) FROM app.membership_roles
                WHERE membership_id=:membership_id AND role_id<>:role_id
            """), {"membership_id": membership_id, "role_id": role_id})).scalar_one()
            if other_roles == 0:
                raise HTTPException(status_code=409,
                    detail="Para retirar el último rol, suspende la membresía y solicita su baja administrativa")
            if role == "student":
                active = (await conn.execute(text("""
                    SELECT 1 FROM app.enrollments e
                    JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
                    WHERE s.organization_id=:organization_id AND s.membership_id=:membership_id
                      AND e.status='active' LIMIT 1
                """), {"organization_id": organization_id, "membership_id": membership_id})).first()
                if active:
                    raise HTTPException(status_code=409, detail="No se puede retirar el rol de estudiante con matrículas activas")
            if role == "instructor":
                assigned = (await conn.execute(text("""
                    SELECT 1 FROM app.course_offerings off
                    JOIN app.instructors i ON i.id=off.instructor_id AND i.organization_id=off.organization_id
                    WHERE i.organization_id=:organization_id AND i.membership_id=:membership_id
                      AND off.status IN ('planned','open') LIMIT 1
                """), {"organization_id": organization_id, "membership_id": membership_id})).first()
                if assigned:
                    raise HTTPException(status_code=409, detail="Reasigna primero las ofertas académicas del docente")
            await conn.execute(text("""
                DELETE FROM app.membership_roles WHERE membership_id=:membership_id AND role_id=:role_id
            """), {"membership_id": membership_id, "role_id": role_id})
            if role == "student":
                await conn.execute(text("""
                    UPDATE app.students SET status='inactive'
                    WHERE organization_id=:organization_id AND membership_id=:membership_id
                """), {"organization_id": organization_id, "membership_id": membership_id})
            elif role == "instructor":
                await conn.execute(text("""
                    UPDATE app.instructors SET status='inactive'
                    WHERE organization_id=:organization_id AND membership_id=:membership_id
                """), {"organization_id": organization_id, "membership_id": membership_id})
            await _audit(conn, organization_id, actor, membership_id, "revoke", role)
        return {"message": "Rol retirado (se conserva la historia académica)"}
    except SQLAlchemyError as exc:
        logger.exception("Error SQL al retirar rol institucional")
        raise HTTPException(status_code=503, detail="No se pudo retirar el rol") from exc


@router.patch("/{organization_id}/members/{membership_id}/status")
async def change_membership_status(
    organization_id: UUID, membership_id: UUID, payload: MembershipStatus,
    auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine),
) -> dict:
    """Suspende o reactiva membresía sin modificar otros tenants ni Auth."""
    try:
        async with engine.begin() as conn:
            actor = await _require_institution_admin(conn, auth_id, organization_id)
            await _lock_organization(conn, organization_id)
            # La revocación global también bloquea la institución: repetir la
            # autorización bajo el mismo bloqueo evita cambios tras una baja.
            await _require_institution_admin(conn, auth_id, organization_id)
            member = await _member_for_update(conn, organization_id, membership_id)
            if member["user_id"] == actor:
                raise HTTPException(status_code=403, detail="No puedes suspender tu propia membresía")
            if member["user_status"] != "active":
                raise HTTPException(status_code=409, detail="Cuenta deshabilitada globalmente")
            if member["status"] == "revoked" or member["status"] == "invited":
                raise HTTPException(status_code=409, detail="Esta membresía requiere revisión de la administración global")
            if member["status"] == payload.status:
                raise HTTPException(status_code=409, detail="La membresía ya está en ese estado")
            await conn.execute(text("""
                UPDATE app.organization_memberships SET status=:status
                WHERE organization_id=:organization_id AND id=:membership_id
            """), {"status": payload.status, "organization_id": organization_id,
                    "membership_id": membership_id})
            await _audit(conn, organization_id, actor, membership_id,
                         "suspend" if payload.status == "suspended" else "reactivate")
        return {"message": "Membresía actualizada"}
    except SQLAlchemyError as exc:
        logger.exception("Error SQL cambiando estado de membresía")
        raise HTTPException(status_code=503, detail="No se pudo actualizar la membresía") from exc
