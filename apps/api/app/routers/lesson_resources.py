"""Recursos privados de borradores académicos (v29.2).

Todo acceso valida el JWT, institución y rol contra PostgreSQL antes de
consultar metadatos o generar acceso temporal al objeto de Storage.
Los estudiantes NO pueden consultar estos borradores. Una publicación futura
copiará las asociaciones de recursos de la revisión autorizada.
"""

import logging
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.config import get_settings
from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.course_content import _audit
from app.routers.lesson_revisions import Source, _authorize, _draft
from app.services.course_resources import (
    MAX_RESOURCE_BYTES,
    normalize_title,
    validate_https_url,
    validate_upload,
)

router = APIRouter(prefix='/api/v1/academic/organizations', tags=['lesson-resources'])
logger = logging.getLogger(__name__)
BUCKET = 'course-resources'


class ResourceLink(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=180)
    url: str = Field(min_length=1, max_length=2048)


def _storage_headers(mime: str | None = None) -> dict[str, str]:
    """Las claves nuevas sb_secret_ se envían solo en apikey (no como JWT)."""
    key = get_settings().supabase_secret_key
    if not key or not get_settings().supabase_url:
        raise HTTPException(status_code=503, detail='Almacenamiento privado no configurado')
    headers = {'apikey': key}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = f'Bearer {key}'
    if mime:
        headers['Content-Type'] = mime
    return headers


def _object_url(path: str) -> str:
    return f'{get_settings().supabase_url}/storage/v1/object/{BUCKET}/{path}'


async def _upload_object(path: str, content: bytes, mime: str) -> None:
    """Envía bytes con clave de servidor, sin exponer URL privilegiada al cliente."""
    headers = _storage_headers(mime)
    headers['x-upsert'] = 'false'
    try:
        async with httpx.AsyncClient(timeout=40.0, follow_redirects=False) as client:
            response = await client.post(_object_url(path), headers=headers, content=content)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning('Falló la subida privada a Storage: %s', type(exc).__name__)
        raise HTTPException(status_code=503, detail='No se pudo guardar el archivo privado') from exc


async def _remove_orphan(path: str) -> None:
    """Mejor esfuerzo de limpieza si falla la transacción posterior a Storage."""
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            await client.request('DELETE', f'{get_settings().supabase_url}/storage/v1/object/{BUCKET}',
                                 headers=_storage_headers('application/json'),
                                 json={'prefixes': [path]})
    except (httpx.HTTPError, HTTPException):
        logger.warning('Objeto Storage pendiente de limpieza tras rollback')


async def _signed_download(path: str) -> str:
    """Devuelve acceso de lectura temporal; la API ya autorizó el recurso."""
    url = f'{get_settings().supabase_url}/storage/v1/object/sign/{BUCKET}/{path}'
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
            response = await client.post(url, headers=_storage_headers('application/json'), json={'expiresIn': 60})
        response.raise_for_status()
        signed = response.json().get('signedURL') or response.json().get('signedUrl')
        if not isinstance(signed, str):
            raise TypeError('Signed URL format')
        # La API REST devuelve normalmente /object/sign/..., mientras que
        # algunas versiones incluyen /storage/v1 al inicio.
        if signed.startswith('/object/sign/'):
            signed = '/storage/v1' + signed
        if not signed.startswith(f'/storage/v1/object/sign/{BUCKET}/'):
            raise ValueError('Signed URL path')
        return f'{get_settings().supabase_url}{signed}'
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning('Fallo preparando descarga privada: %s', type(exc).__name__)
        raise HTTPException(status_code=503, detail='No se pudo generar el acceso temporal') from exc


async def _current_revision(conn: AsyncConnection, auth_id: UUID, org: UUID,
                            lesson_id: UUID, source: Source, *, lock: bool = False) -> tuple[UUID, UUID]:
    actor = await _authorize(conn, auth_id, org, lesson_id, source, lock=lock)
    draft = await _draft(conn, org, lesson_id, source, lock=lock)
    if not draft:
        raise HTTPException(status_code=404, detail='La lección no tiene un borrador editable')
    return actor, draft['id']


async def _next_position(conn: AsyncConnection, org: UUID, revision_id: UUID) -> int:
    """Acota los adjuntos de un borrador a 30 recursos sin bloquear por huecos."""
    row = (await conn.execute(text('''
        SELECT COUNT(*) AS count, COALESCE(MAX(position),0)+1 AS next_position
        FROM app.lesson_revision_resources
        WHERE organization_id=:org AND lesson_revision_id=:rev
    '''), {'org': org, 'rev': revision_id})).mappings().one()
    if row['count'] >= 30:
        raise HTTPException(status_code=409, detail='Límite de 30 recursos por borrador')
    return row['next_position']


async def _resource_list(conn: AsyncConnection, org: UUID, revision_id: UUID) -> list[dict]:
    rows = (await conn.execute(text('''
        SELECT r.id::text, r.resource_kind AS kind, r.title, r.external_url AS url,
               r.position, f.original_filename AS filename,
               f.media_type, f.size_bytes
        FROM app.lesson_revision_resources r
        LEFT JOIN app.resource_files f
          ON f.organization_id=r.organization_id AND f.id=r.file_id
        WHERE r.organization_id=:org AND r.lesson_revision_id=:rev
        ORDER BY r.position, r.id LIMIT 200
    '''), {'org': org, 'rev': revision_id})).mappings().all()
    return [dict(row) for row in rows]


async def _list(org: UUID, lesson_id: UUID, source: Source, auth_id: UUID, engine: AsyncEngine) -> dict:
    try:
        async with engine.connect() as conn:
            _, revision_id = await _current_revision(conn, auth_id, org, lesson_id, source)
            rows = await _resource_list(conn, org, revision_id)
        return {'revision_id': str(revision_id), 'items': rows}
    except SQLAlchemyError as exc:
        logger.exception('Error consultando recursos de lección')
        raise HTTPException(status_code=503, detail='No se pudieron consultar recursos') from exc


async def _add_link(org: UUID, lesson_id: UUID, source: Source, payload: ResourceLink,
                    auth_id: UUID, engine: AsyncEngine) -> dict:
    title = normalize_title(payload.title)
    url = validate_https_url(payload.url)
    try:
        async with engine.begin() as conn:
            actor, revision_id = await _current_revision(conn, auth_id, org, lesson_id, source, lock=True)
            position = await _next_position(conn, org, revision_id)
            resource_id = (await conn.execute(text('''
                INSERT INTO app.lesson_revision_resources
                    (organization_id, lesson_revision_id, resource_kind,
                     title, external_url, position, added_by)
                VALUES (:org,:rev,'link',:title,:url,:position,:actor)
                RETURNING id
            '''), {'org': org, 'rev': revision_id, 'title': title, 'url': url,
                   'position': position, 'actor': actor})).scalar_one()
            await _audit(conn, org, actor, 'attach_link', 'lesson_revision_resources', resource_id)
        return {'id': str(resource_id), 'kind': 'link', 'title': title, 'url': url, 'position': position}
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail='Otro editor modificó los recursos; recarga') from exc
    except SQLAlchemyError as exc:
        logger.exception('Error agregando enlace académico')
        raise HTTPException(status_code=503, detail='No se pudo agregar el enlace') from exc


async def _add_file(org: UUID, lesson_id: UUID, source: Source, request: Request,
                    filename: str, auth_id: UUID, engine: AsyncEngine) -> dict:
    """Carga binaria limitada por streaming. No requiere multipart ni nuevo npm."""
    mime = request.headers.get('content-type', '').split(';')[0].strip().lower()
    if mime not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp'):
        raise HTTPException(status_code=415, detail='Solo PDF, PNG, JPG y WebP')
    # Autorizar antes de recibir los bytes para limitar abuso de tráfico.
    try:
        async with engine.connect() as conn:
            await _current_revision(conn, auth_id, org, lesson_id, source)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail='No se pudo verificar la autorización') from exc
    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > MAX_RESOURCE_BYTES:
            raise HTTPException(status_code=413, detail='Tamaño máximo 10 MB')
    name, extension, checksum = validate_upload(bytes(content), mime, filename)
    resource_id, file_id = uuid4(), uuid4()
    path = ''
    try:
        async with engine.begin() as conn:
            actor, revision_id = await _current_revision(conn, auth_id, org, lesson_id, source, lock=True)
            path = f'{org}/{lesson_id}/{revision_id}/{file_id}.{extension}'
            position = await _next_position(conn, org, revision_id)
            # Transacción PostgreSQL y carga Storage no son atómicas: si falla
            # la escritura SQL se intenta retirar el objeto huérfano.
            await _upload_object(path, bytes(content), mime)
            await conn.execute(text('''
                INSERT INTO app.resource_files
                    (id,organization_id,bucket,object_path,original_filename,
                     media_type,size_bytes,sha256,uploaded_by)
                VALUES (:id,:org,:bucket,:path,:name,:mime,:size,:sha,:actor)
            '''), {'id': file_id, 'org': org, 'bucket': BUCKET, 'path': path,
                   'name': name, 'mime': mime, 'size': len(content), 'sha': checksum,
                   'actor': actor})
            await conn.execute(text('''
                INSERT INTO app.lesson_revision_resources
                    (id,organization_id,lesson_revision_id,resource_kind,file_id,
                     title,position,added_by)
                VALUES (:id,:org,:rev,'file',:file_id,:title,:pos,:actor)
            '''), {'id': resource_id, 'org': org, 'rev': revision_id,
                   'file_id': file_id, 'title': name, 'pos': position, 'actor': actor})
            await _audit(conn, org, actor, 'attach_file', 'lesson_revision_resources', resource_id)
        return {'id': str(resource_id), 'kind': 'file', 'title': name,
                'filename': name, 'media_type': mime, 'size_bytes': len(content),
                'position': position}
    except HTTPException:
        if path:
            await _remove_orphan(path)
        raise
    except IntegrityError as exc:
        if path:
            await _remove_orphan(path)
        raise HTTPException(status_code=409, detail='Recurso concurrente; recarga') from exc
    except SQLAlchemyError as exc:
        if path:
            await _remove_orphan(path)
        logger.exception('Error asociando recurso privado')
        raise HTTPException(status_code=503, detail='No se pudo guardar el recurso') from exc


async def _locate_resource(conn: AsyncConnection, org: UUID, revision_id: UUID,
                           resource_id: UUID) -> dict:
    row = (await conn.execute(text('''
        SELECT r.id, r.resource_kind AS kind, f.object_path, f.media_type
        FROM app.lesson_revision_resources r
        LEFT JOIN app.resource_files f
          ON f.organization_id=r.organization_id AND f.id=r.file_id
        WHERE r.organization_id=:org AND r.lesson_revision_id=:rev AND r.id=:id
    '''), {'org': org, 'rev': revision_id, 'id': resource_id})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail='Recurso no disponible')
    return dict(row)


async def _download(org: UUID, lesson_id: UUID, source: Source,
                    resource_id: UUID, auth_id: UUID, engine: AsyncEngine) -> dict:
    try:
        async with engine.connect() as conn:
            _, revision_id = await _current_revision(conn, auth_id, org, lesson_id, source)
            item = await _locate_resource(conn, org, revision_id, resource_id)
        if item['kind'] != 'file' or not item['object_path']:
            raise HTTPException(status_code=404, detail='Archivo no disponible')
        signed = await _signed_download(item['object_path'])
        return {'url': signed, 'expires_in': 60}
    except SQLAlchemyError as exc:
        logger.exception('Error validando descarga privada')
        raise HTTPException(status_code=503, detail='No se pudo validar la descarga') from exc


async def _unlink(org: UUID, lesson_id: UUID, source: Source,
                  resource_id: UUID, auth_id: UUID, engine: AsyncEngine) -> dict:
    try:
        async with engine.begin() as conn:
            actor, revision_id = await _current_revision(conn, auth_id, org, lesson_id, source, lock=True)
            await _locate_resource(conn, org, revision_id, resource_id)
            await conn.execute(text('''
                DELETE FROM app.lesson_revision_resources
                WHERE organization_id=:org AND lesson_revision_id=:rev AND id=:id
            '''), {'org': org, 'rev': revision_id, 'id': resource_id})
            await _audit(conn, org, actor, 'detach_resource', 'lesson_revision_resources', resource_id)
        # No borrar bytes: pueden quedar referenciados por otra versión.
        # Un proceso futuro limpiará objetos que no tengan referencias.
        return {'deleted': True}
    except SQLAlchemyError as exc:
        logger.exception('Error retirando recurso académico')
        raise HTTPException(status_code=503, detail='No se pudo retirar el recurso') from exc


# Se mantienen rutas separadas por ámbito para no aceptar nombres de tablas
# ni tipos de lección como parámetros SQL proporcionados por el usuario.
@router.get('/{organization_id}/lessons/{lesson_id}/resources')
async def list_institutional_resources(organization_id: UUID, lesson_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _list(organization_id, lesson_id, 'institutional', auth_id, engine)


@router.get('/{organization_id}/offering-lessons/{lesson_id}/resources')
async def list_offering_resources(organization_id: UUID, lesson_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _list(organization_id, lesson_id, 'offering', auth_id, engine)


@router.post('/{organization_id}/lessons/{lesson_id}/resources/links', status_code=status.HTTP_201_CREATED)
async def link_institutional_resource(organization_id: UUID, lesson_id: UUID, payload: ResourceLink,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _add_link(organization_id, lesson_id, 'institutional', payload, auth_id, engine)


@router.post('/{organization_id}/offering-lessons/{lesson_id}/resources/links', status_code=status.HTTP_201_CREATED)
async def link_offering_resource(organization_id: UUID, lesson_id: UUID, payload: ResourceLink,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _add_link(organization_id, lesson_id, 'offering', payload, auth_id, engine)


@router.post('/{organization_id}/lessons/{lesson_id}/resources/files', status_code=status.HTTP_201_CREATED)
async def file_institutional_resource(organization_id: UUID, lesson_id: UUID, request: Request,
    filename: str = Query(min_length=1, max_length=180), auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _add_file(organization_id, lesson_id, 'institutional', request, filename, auth_id, engine)


@router.post('/{organization_id}/offering-lessons/{lesson_id}/resources/files', status_code=status.HTTP_201_CREATED)
async def file_offering_resource(organization_id: UUID, lesson_id: UUID, request: Request,
    filename: str = Query(min_length=1, max_length=180), auth_id: UUID = Depends(authenticated_user_id),
    engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _add_file(organization_id, lesson_id, 'offering', request, filename, auth_id, engine)


@router.get('/{organization_id}/lessons/{lesson_id}/resources/{resource_id}/download')
async def download_institutional_resource(organization_id: UUID, lesson_id: UUID, resource_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _download(organization_id, lesson_id, 'institutional', resource_id, auth_id, engine)


@router.get('/{organization_id}/offering-lessons/{lesson_id}/resources/{resource_id}/download')
async def download_offering_resource(organization_id: UUID, lesson_id: UUID, resource_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _download(organization_id, lesson_id, 'offering', resource_id, auth_id, engine)


@router.delete('/{organization_id}/lessons/{lesson_id}/resources/{resource_id}')
async def unlink_institutional_resource(organization_id: UUID, lesson_id: UUID, resource_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _unlink(organization_id, lesson_id, 'institutional', resource_id, auth_id, engine)


@router.delete('/{organization_id}/offering-lessons/{lesson_id}/resources/{resource_id}')
async def unlink_offering_resource(organization_id: UUID, lesson_id: UUID, resource_id: UUID,
    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    return await _unlink(organization_id, lesson_id, 'offering', resource_id, auth_id, engine)
