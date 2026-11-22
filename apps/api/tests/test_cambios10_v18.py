"""Regresión v18: idioma propio sin alterar otros atributos o saltarse Auth."""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

AUTH_ID = UUID('11111111-1111-4111-8111-111111111111')
USER_ID = UUID('22222222-2222-4222-8222-222222222222')


class StubResult:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value


class StubDB:
    def __init__(self):
        self.active = True
        self.committed = False
        self.calls = []

    def begin(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, *_):
        self.committed = exc_type is None

    async def execute(self, statement, parameters):
        sql = str(statement)
        self.calls.append((sql, parameters))
        if 'SELECT u.id FROM app.users u' in sql:
            return StubResult((USER_ID,) if self.active else None)
        return StubResult(None)


@pytest.fixture
def client_with_db():
    database = StubDB()
    app.dependency_overrides[authenticated_user_id] = lambda: AUTH_ID
    app.dependency_overrides[require_engine] = lambda: database
    yield TestClient(app), database
    app.dependency_overrides.clear()


@pytest.mark.parametrize('lang', ['es', 'en', 'pt'])
def test_language_update_only_changes_language(client_with_db, lang):
    client, db = client_with_db
    result = client.patch('/api/v1/me/language', json={'language_code': lang})
    assert result.status_code == 200
    assert result.json() == {'language_code': lang}
    assert db.committed
    assert db.calls[0][1] == {'auth_id': AUTH_ID}
    sql, args = db.calls[1]
    assert 'INSERT INTO app.user_profile_details' in sql
    assert 'SET language_code=EXCLUDED.language_code' in sql
    assert args == {'user_id': USER_ID, 'language_code': lang}
    # No debe tocar ningún atributo privado ni modificar permisos.
    assert all(field not in sql for field in ('country_code', 'birth_date', 'sex', 'share_locale_with_staff'))
    assert 'update_preferred_language' in db.calls[2][0]


@pytest.mark.parametrize('payload', [
    {'language_code': 'fr'}, {'language_code': 'es', 'country_code': 'PE'},
    {'language_code': 'es', 'user_id': str(USER_ID)}, {},
    {'language_code': 'pt-BR'}, {'language_code': None},
])
def test_language_update_rejects_unsupported_codes_and_extra_fields(client_with_db, payload):
    client, db = client_with_db
    result = client.patch('/api/v1/me/language', json=payload)
    assert result.status_code == 422
    assert not db.calls


def test_language_update_fails_closed_for_inactive_account(client_with_db):
    client, db = client_with_db
    db.active = False
    result = client.patch('/api/v1/me/language', json={'language_code': 'en'})
    assert result.status_code == 403
    assert not db.committed
    assert len(db.calls) == 1


def test_language_route_requires_authentication():
    client = TestClient(app)
    assert client.patch('/api/v1/me/language', json={'language_code': 'en'}).status_code == 401
