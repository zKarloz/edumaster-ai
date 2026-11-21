"""Pruebas del perfil propio con una conexión simulada; no usa Supabase real."""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

AUTH = UUID('11111111-1111-4111-8111-111111111111')
USER = UUID('22222222-2222-4222-8222-222222222222')
URL = '/api/v1/me/profile'


class Engine:
    def __init__(self, active=True, fail=False):
        self.active = active
        self.fail = fail
        self.calls = []
        self.committed = False

    def begin(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, *_):
        self.committed = exc_type is None

    async def execute(self, statement, params):
        self.calls.append((str(statement), params))
        if self.fail and 'audit_logs' in str(statement):
            raise SQLAlchemyError('simulated audit failure')
        return self

    def mappings(self):
        return self

    def first(self):
        if not self.active:
            return None
        return {'id': USER, 'full_name': 'Nombre DEMO', 'email_normalized': 'demo@example.org'}


@pytest.fixture
def setup():
    engine = Engine()
    app.dependency_overrides[authenticated_user_id] = lambda: AUTH
    app.dependency_overrides[require_engine] = lambda: engine
    yield engine, TestClient(app)
    app.dependency_overrides.clear()


def test_profile_auth_required():
    assert TestClient(app).patch(URL, json={'name': 'Nombre DEMO'}).status_code == 401


def test_update_self_and_audit(setup):
    engine, client = setup
    response = client.patch(URL, json={'name': ' Nombre DEMO '})
    assert response.status_code == 200
    assert response.json()['name'] == 'Nombre DEMO'
    assert engine.calls[0][1] == {'name': 'Nombre DEMO', 'auth_id': AUTH}
    assert 'u.auth_user_id = :auth_id' in engine.calls[0][0]
    assert 'u.status = \'active\'' in engine.calls[0][0]
    assert 'audit_logs' in engine.calls[1][0]
    assert engine.calls[1][1] == {'id': USER}
    assert engine.committed


@pytest.mark.parametrize('payload', [{'name': ' '}, {'name': 'x'}, {'name': 'a' * 181}, {'name': 'Nombre DEMO', 'user_id': str(USER)}, {'name': 'Nombre DEMO', 'roles': ['superadmin']}, {'name': 'Nombre DEMO', 'email': 'other@example.org'}])
def test_reject_invalid_or_privileged_fields(setup, payload):
    engine, client = setup
    assert client.patch(URL, json=payload).status_code == 422
    assert not engine.calls


def test_inactive_profile(setup):
    engine, client = setup
    engine.active = False
    assert client.patch(URL, json={'name': 'Nombre DEMO'}).status_code == 403
    assert not engine.committed
    assert len(engine.calls) == 1


def test_audit_failure_rolls_back(setup):
    engine, client = setup
    engine.fail = True
    assert client.patch(URL, json={'name': 'Nombre DEMO'}).status_code == 503
    assert not engine.committed
