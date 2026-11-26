"""Pruebas de contrato y autorización con conexión SQL simulada."""

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app
from app.routers import course_community as community

ID = UUID('11111111-1111-4111-8111-111111111111')
PATH = f'/api/v1/academic/organizations/{ID}/course-offerings/{ID}/community'
PAYLOAD = {'kind': 'question', 'title': 'Una pregunta', 'body': 'Consulta académica.'}


@pytest.mark.parametrize('method,path,body', [
    ('GET', PATH, None), ('POST', PATH, PAYLOAD),
    ('GET', f'{PATH}/{ID}/comments', None), ('POST', f'{PATH}/{ID}/comments', {'body': 'Respuesta'}),
    ('PUT', f'{PATH}/{ID}/reaction', {'liked': True}), ('PATCH', f'{PATH}/{ID}/hide', None),
    ('PATCH', f'{PATH}/{ID}/comments/{ID}/hide', None),
])
def test_anonymous(method, path, body):
    assert TestClient(app).request(method, path, json=body).status_code == 401


@pytest.fixture
def scoped(monkeypatch):
    conn = MagicMock()
    conn.execute = AsyncMock(return_value=MagicMock())
    engine = MagicMock()
    engine.begin.return_value.__aenter__.return_value = conn
    context = {'editor': False, 'enrollment_id': ID, 'actor': ID, 'enrollment_status': 'active',
               'offering_status': 'open', 'course_status': 'published'}
    monkeypatch.setattr(community, '_context', AsyncMock(return_value=context))
    monkeypatch.setattr(community, '_audit', AsyncMock())
    monkeypatch.setitem(app.dependency_overrides, authenticated_user_id, lambda: ID)
    monkeypatch.setitem(app.dependency_overrides, require_engine, lambda: engine)
    return conn, context


def test_student_cannot_announce_or_moderate(scoped):
    conn, _ = scoped
    client = TestClient(app)
    assert client.post(PATH, json=PAYLOAD | {'kind': 'announcement'}).status_code == 403
    assert client.patch(f'{PATH}/{ID}/hide').status_code == 403
    assert client.patch(f'{PATH}/{ID}/comments/{ID}/hide').status_code == 403
    conn.execute.assert_not_awaited()


def test_student_question(scoped):
    conn, _ = scoped
    conn.execute.return_value.scalar_one.return_value = ID
    assert TestClient(app).post(PATH, json=PAYLOAD).status_code == 201
    assert conn.execute.await_args.args[1]['off'] == ID
    community._audit.assert_awaited_once()


def test_read_only(scoped):
    conn, ctx = scoped
    ctx['offering_status'] = 'closed'
    assert TestClient(app).post(PATH, json=PAYLOAD).status_code == 409
    conn.execute.assert_not_awaited()


def test_missing_or_hidden_post(scoped):
    conn, _ = scoped
    conn.execute.return_value.scalar_one_or_none.return_value = None
    assert TestClient(app).post(f'{PATH}/{ID}/comments', json={'body': 'Respuesta'}).status_code == 404
    assert conn.execute.await_count == 1
    assert 'hidden_at IS NULL' in str(conn.execute.await_args.args[0])


def test_reaction_is_scoped_and_idempotent(scoped):
    conn, _ = scoped
    conn.execute.return_value.scalar_one_or_none.return_value = ID
    assert TestClient(app).put(f'{PATH}/{ID}/reaction', json={'liked': True}).status_code == 200
    sql, params = conn.execute.await_args.args
    assert 'ON CONFLICT DO NOTHING' in str(sql)
    assert params['org'] == params['off'] == params['actor'] == ID


def test_feed_scoped(scoped):
    conn, _ = scoped
    conn.execute.return_value.mappings.return_value.all.return_value = []
    assert TestClient(app).get(PATH).json() == {'editor': False, 'writable': True, 'items': []}
    assert 'p.organization_id=:org AND p.offering_id=:off' in str(conn.execute.await_args.args[0])


def test_editor_hide(scoped):
    conn, ctx = scoped
    ctx['editor'] = True
    conn.execute.return_value.scalar_one_or_none.return_value = ID
    assert TestClient(app).patch(f'{PATH}/{ID}/hide').status_code == 200
    assert 'hidden_at=now()' in str(conn.execute.await_args.args[0])
    community._audit.assert_awaited_once()
