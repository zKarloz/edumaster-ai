"""Contrato de recomendaciones; las conexiones SQL son simuladas."""

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app
from app.routers import teacher_recommendations as rec

ID = UUID('11111111-1111-4111-8111-111111111111')
PATH = f'/api/v1/academic/organizations/{ID}/course-offerings/{ID}/recommendations'
PAYLOAD = {'enrollment_id': str(ID), 'title': 'Revisar unidad', 'body': 'Revisa los ejercicios.', 'priority': 'high'}


@pytest.mark.parametrize('method,path', [('GET', PATH), ('POST', PATH), ('PATCH', f'{PATH}/{ID}/complete')])
def test_anonymous(method, path):
    assert TestClient(app).request(method, path, json=PAYLOAD).status_code == 401


@pytest.fixture
def scoped(monkeypatch):
    conn = MagicMock()
    conn.execute = AsyncMock(return_value=MagicMock())
    engine = MagicMock()
    engine.begin.return_value.__aenter__.return_value = conn
    context = {'editor': False, 'enrollment_id': ID, 'actor': ID}
    monkeypatch.setattr(rec, '_context', AsyncMock(return_value=context))
    monkeypatch.setattr(rec, '_audit', AsyncMock())
    monkeypatch.setitem(app.dependency_overrides, authenticated_user_id, lambda: ID)
    monkeypatch.setitem(app.dependency_overrides, require_engine, lambda: engine)
    return conn, context


def test_student_cannot_create(scoped):
    conn, _ = scoped
    assert TestClient(app).post(PATH, json=PAYLOAD).status_code == 403
    conn.execute.assert_not_awaited()


def test_student_list_is_scoped(scoped):
    conn, _ = scoped
    conn.execute.return_value.mappings.return_value.all.return_value = []
    response = TestClient(app).get(PATH)
    assert response.json() == {'editor': False, 'recipients': [], 'items': []}
    sql, params = conn.execute.await_args.args
    assert 'r.enrollment_id=:enrollment' in str(sql)
    assert params['enrollment'] == ID


@pytest.mark.parametrize('found,status', [(True, 201), (False, 404)])
def test_editor_create(scoped, found, status):
    conn, context = scoped
    context['editor'] = True
    conn.execute.return_value.scalar_one_or_none.return_value = ID if found else None
    assert TestClient(app).post(PATH, json=PAYLOAD).status_code == status
    assert 'e.offering_id=:off' in str(conn.execute.await_args.args[0])
    assert rec._audit.await_count == int(found)


@pytest.mark.parametrize('found,status', [(True, 200), (False, 404)])
def test_student_complete(scoped, found, status):
    conn, _ = scoped
    conn.execute.return_value.scalar_one_or_none.return_value = ID if found else None
    assert TestClient(app).patch(f'{PATH}/{ID}/complete').status_code == status
    assert 'r.enrollment_id=:enrollment' in str(conn.execute.await_args.args[0])
    assert rec._audit.await_count == int(found)


def test_editor_without_enrollment_cannot_complete(scoped):
    conn, context = scoped
    context.update({'editor': True, 'enrollment_id': None})
    assert TestClient(app).patch(f'{PATH}/{ID}/complete').status_code == 403
    conn.execute.assert_not_awaited()


def test_invalid_priority(scoped):
    conn, context = scoped
    context['editor'] = True
    assert TestClient(app).post(PATH, json=PAYLOAD | {'priority': 'critical'}).status_code == 422
    conn.execute.assert_not_awaited()
