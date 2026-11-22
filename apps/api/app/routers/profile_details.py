"""Datos de perfil opcionales y ficha administrativa de acceso limitado.

No devuelve fecha de nacimiento ni sexo al administrador institucional. Todo
acceso se verifica contra identidad JWT, institución y membresía en SQL.
"""
import logging
import re
from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id

router = APIRouter(prefix='/api/v1', tags=['user-profile-details'])
logger = logging.getLogger(__name__)


class PersonalDetails(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    language_code: str | None = Field(default=None, max_length=32)
    country_code: str | None = Field(default=None, max_length=2)
    birth_date: date | None = None
    sex: Literal['female', 'male', 'non_binary', 'prefer_not_to_say'] | None = None
    share_locale_with_staff: bool = False

    @field_validator('country_code', mode='before')
    @classmethod
    def country(cls, value):
        if value in ('', None):
            return None
        if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z]{2}', value.strip()):
            raise ValueError('País: utiliza dos letras ISO 3166-1')
        return value.strip().upper()

    @field_validator('language_code', mode='before')
    @classmethod
    def language(cls, value):
        if value in ('', None):
            return None
        if not isinstance(value, str):
            # Pydantic convierte ValueError en HTTP 422; TypeError no se transforma.
            raise ValueError('Idioma no válido')  # noqa: TRY004
        return value.strip()

    @field_validator('language_code')
    @classmethod
    def valid_language(cls, value):
        if value and not re.fullmatch(r'[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}', value):
            raise ValueError('El idioma debe ser un código BCP 47 (es, en, pt-BR)')
        return value

    @field_validator('birth_date')
    @classmethod
    def valid_birth_date(cls, value):
        if value and value > date.today():
            raise ValueError('La fecha de nacimiento no puede ser futura')
        return value


# Fuente única de datos propios. No se depende de un ID recibido del navegador.
PROFILE_SELECT = text('''
    SELECT d.language_code, d.country_code, d.birth_date, d.sex,
           COALESCE(d.share_locale_with_staff, false) AS share_locale_with_staff
    FROM app.users u
    LEFT JOIN app.user_profile_details d ON d.user_id=u.id
    WHERE u.auth_user_id=:auth_id AND u.status='active'
''')


@router.get('/me/details')
async def get_own_details(auth_id: UUID = Depends(authenticated_user_id),
                          engine: AsyncEngine = Depends(require_engine)) -> dict:
    try:
        async with engine.connect() as conn:
            row = (await conn.execute(PROFILE_SELECT, {'auth_id': auth_id})).mappings().first()
            if not row:
                raise HTTPException(status_code=403, detail='Cuenta no habilitada')
            return dict(row)
    except SQLAlchemyError as exc:
        logger.exception('Error leyendo detalles personales')
        raise HTTPException(status_code=503, detail='No se pudieron consultar tus datos personales; verifica migración 004') from exc


@router.patch('/me/details')
async def update_own_details(payload: PersonalDetails,
                             auth_id: UUID = Depends(authenticated_user_id),
                             engine: AsyncEngine = Depends(require_engine)) -> dict:
    """Escritura atómica, con registro de auditoría sin valores personales."""
    try:
        async with engine.begin() as conn:
            user = (await conn.execute(text('''
                SELECT u.id FROM app.users u
                WHERE u.auth_user_id=:auth_id AND u.status='active' AND (
                   EXISTS (SELECT 1 FROM app.global_role_assignments g WHERE g.user_id=u.id)
                   OR EXISTS (SELECT 1 FROM app.organization_memberships m
                     JOIN app.organizations o ON o.id=m.organization_id
                     WHERE m.user_id=u.id AND m.status='active' AND o.status='active')
                )
            '''), {'auth_id': auth_id})).first()
            if not user:
                raise HTTPException(status_code=403, detail='Cuenta sin acceso activo')
            data = payload.model_dump()
            await conn.execute(text('''
                INSERT INTO app.user_profile_details
                  (user_id, language_code, country_code, birth_date, sex, share_locale_with_staff)
                VALUES (:user_id, :language_code, :country_code, :birth_date, :sex, :share_locale_with_staff)
                ON CONFLICT (user_id) DO UPDATE SET
                  language_code=EXCLUDED.language_code,
                  country_code=EXCLUDED.country_code,
                  birth_date=EXCLUDED.birth_date,
                  sex=EXCLUDED.sex,
                  share_locale_with_staff=EXCLUDED.share_locale_with_staff,
                  updated_at=now()
            '''), {**data, 'user_id': user[0]})
            await conn.execute(text('''
                INSERT INTO app.audit_logs (actor_id, action, resource, resource_id, metadata)
                VALUES (:user_id, 'update_personal_details', 'users', :user_id,
                        '{"fields":"personal_details"}'::jsonb)
            '''), {'user_id': user[0]})
        return data
    except SQLAlchemyError as exc:
        logger.exception('Error actualizando detalles personales')
        raise HTTPException(status_code=503, detail='No se pudieron guardar tus datos; verifica migración 004') from exc


@router.get('/directory/users/{user_id}')
async def directory_user_details(user_id: UUID, organization_id: UUID,
                                 auth_id: UUID = Depends(authenticated_user_id),
                                 engine: AsyncEngine = Depends(require_engine)) -> dict:
    """Superadmin o administrador activo de la institución solicitada.

    Los atributos íntimos nunca forman parte de esta respuesta; país e idioma
    solo se comparten si el propio usuario lo autorizó.
    """
    try:
        async with engine.connect() as conn:
            row = (await conn.execute(text('''
                SELECT u.id::text AS user_id, u.auth_user_id::text AS auth_user_id,
                       u.full_name AS name, u.email_normalized AS email,
                       m.status AS membership_status, o.name AS organization_name,
                       COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL),
                          ARRAY[]::text[]) AS roles,
                       CASE WHEN COALESCE(p.share_locale_with_staff, false)
                            THEN p.country_code ELSE NULL END AS country_code,
                       CASE WHEN COALESCE(p.share_locale_with_staff, false)
                            THEN p.language_code ELSE NULL END AS language_code
                FROM app.users u
                JOIN app.organization_memberships m ON m.user_id=u.id
                     AND m.organization_id=:organization_id
                JOIN app.organizations o ON o.id=m.organization_id
                LEFT JOIN app.membership_roles mr ON mr.membership_id=m.id
                LEFT JOIN app.roles r ON r.id=mr.role_id AND r.scope='organization'
                LEFT JOIN app.user_profile_details p ON p.user_id=u.id
                WHERE u.id=:user_id AND EXISTS (
                  SELECT 1 FROM app.users actor WHERE actor.auth_user_id=:auth_id AND actor.status='active'
                    AND (
                       EXISTS (SELECT 1 FROM app.global_role_assignments ga
                         JOIN app.roles gr ON gr.id=ga.role_id
                         WHERE ga.user_id=actor.id AND gr.code='superadmin' AND gr.scope='global')
                       OR EXISTS (SELECT 1 FROM app.organization_memberships am
                         JOIN app.membership_roles ar ON ar.membership_id=am.id
                         JOIN app.roles role ON role.id=ar.role_id
                         WHERE am.user_id=actor.id AND am.organization_id=:organization_id
                           AND am.status='active' AND role.code='institution_admin'
                           AND role.scope='organization' AND o.status='active')
                    )
                )
                GROUP BY u.id, u.auth_user_id, u.full_name, u.email_normalized, m.status,
                         o.name, p.share_locale_with_staff, p.country_code, p.language_code
            '''), {'user_id': user_id, 'organization_id': organization_id,
                   'auth_id': auth_id})).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail='Usuario no encontrado o sin autorización')
        return dict(row)
    except SQLAlchemyError as exc:
        logger.exception('Error consultando ficha de usuario')
        raise HTTPException(status_code=503, detail='No se pudo consultar la ficha') from exc
