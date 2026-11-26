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
               page: int = Query(1, ge=1, le=1000000), page_size: int = Query(5, ge=5, le=20), focus: UUID | None = Query(None)) -> dict:
    async with engine.begin() as conn:
        ctx = await _context(conn, auth_id, organization_id, offering_id)
        params = {'org': organization_id, 'off': offering_id, 'actor': ctx['actor']}
        if page_size not in (5, 10, 20):
            raise HTTPException(422, 'Tamaño de página no admitido')
        total = (await conn.execute(text('''SELECT count(*) FROM app.community_posts p
            WHERE p.organization_id=:org AND p.offering_id=:off AND p.hidden_at IS NULL'''), params)).scalar_one()
        # Buscar la página del aviso sin revelar publicaciones ocultas ni de otra oferta.
        if focus is not None:
            position = (await conn.execute(text('''
                SELECT position FROM (
                    SELECT id,row_number() OVER (ORDER BY created_at DESC,id) AS position
                    FROM app.community_posts WHERE organization_id=:org AND offering_id=:off
                      AND hidden_at IS NULL
                ) ranked WHERE id=:focus
            '''), {**params, 'focus': focus})).scalar_one_or_none()
            if position is None:
                raise HTTPException(404, 'Publicación no disponible')
            page = (position - 1) // page_size + 1
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


@router.get(PATH + '/participants')
async def participants(organization_id: UUID, offering_id: UUID,
                       auth_id: UUID = Depends(authenticated_user_id), engine: AsyncEngine = Depends(require_engine),
                       target: UUID | None = None) -> dict:
    """Ficha académica mínima: docente asignado o autor visible de esta oferta."""
    async with engine.begin() as conn:
        await _context(conn, auth_id, organization_id, offering_id)
        rows = (await conn.execute(text("""
            SELECT u.full_name AS name, u.auth_user_id AS auth_user_id,
                   o.name AS organization_name, c.title AS course_name,
                   CASE WHEN i.id IS NOT NULL THEN 'instructor'
                        WHEN EXISTS (SELECT 1 FROM app.enrollments e JOIN app.students s
                          ON s.id=e.student_id AND s.organization_id=e.organization_id
                          WHERE e.organization_id=o.id AND e.offering_id=off.id
                            AND s.membership_id=m.id AND s.status='active'
                            AND e.status IN ('active','completed')) THEN 'student'
                        ELSE 'participant' END AS academic_role
            FROM app.course_offerings off
            JOIN app.organizations o ON o.id=off.organization_id
            JOIN app.courses c ON c.id=off.course_id AND c.organization_id=o.id
            JOIN app.organization_memberships m ON m.organization_id=o.id AND m.status='active'
            JOIN app.users u ON u.id=m.user_id AND u.status='active'
            LEFT JOIN app.instructors i ON i.id=off.instructor_id AND i.organization_id=o.id
                AND i.membership_id=m.id AND i.status='active'
            WHERE off.organization_id=:org AND off.id=:off
              AND (CAST(:target AS uuid) IS NULL OR u.auth_user_id=:target)
              AND (i.id IS NOT NULL OR (CAST(:target AS uuid) IS NOT NULL AND EXISTS (
                SELECT 1 FROM app.community_posts p WHERE p.organization_id=o.id AND p.offering_id=off.id
                AND p.hidden_at IS NULL AND (p.author_id=u.id OR EXISTS (
                  SELECT 1 FROM app.community_comments cm WHERE cm.organization_id=o.id
                    AND cm.offering_id=off.id AND cm.post_id=p.id AND cm.hidden_at IS NULL AND cm.author_id=u.id))))
              ) ORDER BY u.full_name
        """), {'org': organization_id, 'off': offering_id, 'target': target})).mappings().all()
        if target is not None and not rows:
            raise HTTPException(404, 'Perfil académico no disponible')
        return {'items': [dict(row) for row in rows]}
