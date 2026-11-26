"""Comunidad por oferta: autorización institucional en todas las operaciones."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.academic_activity import _audit
from app.routers.course_tasks import _context, _editor

router = APIRouter(prefix='/api/v1/academic/organizations', tags=['course-community'])
PATH = '/{organization_id}/course-offerings/{offering_id}/community'


class PostIn(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    kind: Literal['announcement', 'question']
    title: str = Field(min_length=3, max_length=150)
    body: str = Field(min_length=5, max_length=3000)


class CommentIn(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    body: str = Field(min_length=2, max_length=2000)


class ReactionIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    liked: bool


def writable(ctx):
    """Los participantes pueden leer el historial, pero solo escribir en ofertas abiertas."""
    if ctx['offering_status'] != 'open' or ctx['course_status'] != 'published':
        raise HTTPException(409, 'Comunidad de solo lectura')
    if not ctx['editor'] and ctx['enrollment_status'] != 'active':
        raise HTTPException(403, 'Requiere matrícula activa')


async def visible_post(conn, params):
    row = (await conn.execute(text('''
        SELECT id FROM app.community_posts WHERE organization_id=:org AND offering_id=:off
        AND id=:post AND hidden_at IS NULL FOR UPDATE
    '''), params)).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, 'Publicación no disponible')


@router.get(PATH)
async def feed(organization_id: UUID, offering_id: UUID,
               auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
               page: int = Query(1, ge=1, le=1000000), page_size: int = Query(5, ge=5, le=20)) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        params = {'org': organization_id, 'off': offering_id, 'actor': ctx['actor']}
        if page_size not in (5, 10, 20):
            raise HTTPException(422, 'Tamaño de página no admitido')
        total = (await conn.execute(text('''SELECT count(*) FROM app.community_posts p
            WHERE p.organization_id=:org AND p.offering_id=:off AND p.hidden_at IS NULL'''), params)).scalar_one()
        page = min(page, max(1, (total + page_size - 1) // page_size))
        params.update(limit=page_size, offset=(page - 1) * page_size)
        posts = (await conn.execute(text('''
            SELECT p.id,p.kind,p.title,p.body,p.created_at,u.full_name AS author,
                CASE WHEN u.status='active' THEN u.auth_user_id END AS author_auth_id,
                (SELECT count(*) FROM app.community_reactions r WHERE r.organization_id=p.organization_id
                 AND r.offering_id=p.offering_id AND r.post_id=p.id) AS likes,
                EXISTS(SELECT 1 FROM app.community_reactions r WHERE r.organization_id=p.organization_id
                 AND r.offering_id=p.offering_id AND r.post_id=p.id AND r.author_id=:actor) AS liked
            FROM app.community_posts p JOIN app.users u ON u.id=p.author_id
            WHERE p.organization_id=:org AND p.offering_id=:off AND p.hidden_at IS NULL
            ORDER BY p.created_at DESC,p.id LIMIT :limit OFFSET :offset
        '''), params)).mappings().all()
        can_write = True
        try:
            writable(ctx)
        except HTTPException:
            can_write = False
        return {'editor': ctx['editor'], 'writable': can_write, 'items': [dict(row) for row in posts],
                'total': total, 'page': page, 'page_size': page_size}


@router.post(PATH, status_code=201)
async def create_post(organization_id: UUID, offering_id: UUID, payload: PostIn,
                      auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        writable(ctx)
        if payload.kind == 'announcement':
            _editor(ctx)
        params = {'org': organization_id, 'off': offering_id, 'actor': ctx['actor'], **payload.model_dump()}
        row = (await conn.execute(text('''
            INSERT INTO app.community_posts(organization_id,offering_id,author_id,kind,title,body)
            VALUES (:org,:off,:actor,:kind,:title,:body) RETURNING id
        '''), params)).scalar_one()
        await _audit(conn, organization_id, ctx['actor'], 'create', 'community_post', row)
        return {'id': row}


@router.get(PATH + '/{post_id}/comments')
async def comments(organization_id: UUID, offering_id: UUID, post_id: UUID,
                   auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    async with engine.begin() as conn:
        await _context(conn, auth_id, organization_id, offering_id)
        params = {'org': organization_id, 'off': offering_id, 'post': post_id}
        await visible_post(conn, params)
        rows = (await conn.execute(text('''
            SELECT c.id,c.body,c.created_at,u.full_name AS author,
                CASE WHEN u.status='active' THEN u.auth_user_id END AS author_auth_id
            FROM app.community_comments c
            JOIN app.users u ON u.id=c.author_id WHERE c.organization_id=:org AND c.offering_id=:off
            AND c.post_id=:post AND c.hidden_at IS NULL ORDER BY c.created_at DESC,c.id LIMIT 100
        '''), params)).mappings().all()
        return {'items': [dict(row) for row in rows]}


@router.post(PATH + '/{post_id}/comments', status_code=201)
async def create_comment(organization_id: UUID, offering_id: UUID, post_id: UUID, payload: CommentIn,
                         auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        writable(ctx)
        params = {'org': organization_id, 'off': offering_id, 'post': post_id, 'actor': ctx['actor'], 'body': payload.body}
        await visible_post(conn, params)
        row = (await conn.execute(text('''
            INSERT INTO app.community_comments(organization_id,offering_id,post_id,author_id,body)
            VALUES (:org,:off,:post,:actor,:body) RETURNING id
        '''), params)).scalar_one()
        return {'id': row}


@router.put(PATH + '/{post_id}/reaction')
async def reaction(organization_id: UUID, offering_id: UUID, post_id: UUID, payload: ReactionIn,
                   auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        writable(ctx)
        params = {'org': organization_id, 'off': offering_id, 'post': post_id, 'actor': ctx['actor']}
        await visible_post(conn, params)
        if payload.liked:
            await conn.execute(text('''INSERT INTO app.community_reactions(organization_id,offering_id,post_id,author_id)
                VALUES (:org,:off,:post,:actor) ON CONFLICT DO NOTHING'''), params)
        else:
            await conn.execute(text('''DELETE FROM app.community_reactions WHERE organization_id=:org
                AND offering_id=:off AND post_id=:post AND author_id=:actor'''), params)
        return {'liked': payload.liked}


@router.patch(PATH + '/{post_id}/hide')
async def hide_post(organization_id: UUID, offering_id: UUID, post_id: UUID,
                    auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        _editor(ctx)
        params = {'org': organization_id, 'off': offering_id, 'post': post_id}
        await visible_post(conn, params)
        await conn.execute(text('''UPDATE app.community_posts SET hidden_at=now()
            WHERE organization_id=:org AND offering_id=:off AND id=:post'''), params)
        await _audit(conn, organization_id, ctx['actor'], 'hide', 'community_post', post_id)
        return {'id': post_id}


@router.patch(PATH + '/{post_id}/comments/{comment_id}/hide')
async def hide_comment(organization_id: UUID, offering_id: UUID, post_id: UUID, comment_id: UUID,
                       auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine)) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        _editor(ctx)
        params = {'org': organization_id, 'off': offering_id, 'post': post_id, 'comment': comment_id}
        await visible_post(conn, params)
        row = (await conn.execute(text('''UPDATE app.community_comments SET hidden_at=now()
            WHERE organization_id=:org AND offering_id=:off AND post_id=:post AND id=:comment
            AND hidden_at IS NULL RETURNING id'''), params)).scalar_one_or_none()
        if row is None:
            raise HTTPException(404, 'Comentario no disponible')
        await _audit(conn, organization_id, ctx['actor'], 'hide', 'community_comment', row)
        return {'id': row}
