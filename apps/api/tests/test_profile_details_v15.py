"""Regresión v15: propiedad de datos personales y aislamiento por institución."""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

ACTOR = UUID('11111111-1111-4111-8111-111111111111')
USER = UUID('22222222-2222-4222-8222-222222222222')
ORG = UUID('33333333-3333-4333-8333-333333333333')


class Result:
    def __init__(self, mapping=None, row=None):
        self._mapping = mapping
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._mapping if self._mapping is not None else self._row


class Db:
    def __init__(self, active=True, directory=True):
        self.active = active
        self.directory = directory
        self.calls = []
        self.committed = False

    def connect(self):
        return self

    def begin(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, *_):
        self.committed = exc_type is None

    async def execute(self, stmt, params):
        sql = str(stmt)
        self.calls.append((sql, params))
        if 'SELECT d.language_code' in sql:
            return Result({'language_code': 'es', 'country_code': 'PE', 'birth_date': None,
                           'sex': None, 'share_locale_with_staff': False} if self.active else None)
        if 'SELECT u.id FROM app.users u' in sql and 'global_role_assignments' in sql:
            return Result(row=(USER,) if self.active else None)
        if 'u.auth_user_id::text AS auth_user_id' in sql:
            return Result({'user_id': str(USER), 'auth_user_id': str(ACTOR), 'name': 'Usuario DEMO',
                           'email': 'demo@example.org', 'membership_status': 'active',
                           'organization_name': 'Centro DEMO', 'roles': ['student'],
                           'country_code': None, 'language_code': None} if self.directory else None)
        return Result()


@pytest.fixture
def api():
    database = Db()
    app.dependency_overrides[require_engine] = lambda: database
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    yield database, TestClient(app)
    app.dependency_overrides.clear()


def test_protected_routes_require_authentication():
    client = TestClient(app)
    assert client.get('/api/v1/me/details').status_code == 401
    assert client.get(f'/api/v1/directory/users/{USER}', params={'organization_id': str(ORG)}).status_code == 401


def test_read_own_optional_attributes(api):
    db, client = api
    response = client.get('/api/v1/me/details')
    assert response.status_code == 200
    assert response.json()['country_code'] == 'PE'
    assert db.calls[0][1] == {'auth_id': ACTOR}


def test_patch_requires_own_identity_and_audits_without_sensitive_values(api):
    db, client = api
    request = {'country_code': 'pe', 'language_code': 'es', 'birth_date': '1999-09-22',
               'sex': 'prefer_not_to_say', 'share_locale_with_staff': False}
    result = client.patch('/api/v1/me/details', json=request)
    assert result.status_code == 200
    assert result.json()['country_code'] == 'PE'
    assert db.committed
    assert db.calls[0][1] == {'auth_id': ACTOR}
    assert db.calls[1][1]['user_id'] == USER
    assert db.calls[1][1]['country_code'] == 'PE'
    assert 'update_personal_details' in db.calls[2][0]
    assert '1999-09-22' not in db.calls[2][0]


@pytest.mark.parametrize('payload', [
    {'country_code': 'XYZ'}, {'country_code': 'P4'}, {'language_code': 'INVALID!'},
    {'birth_date': '2999-01-01'}, {'sex': 'private_secret'},
    {'roles': ['superadmin']}, {'user_id': str(USER)},
])
def test_reject_invalid_or_privileged_fields(api, payload):
    db, client = api
    result = client.patch('/api/v1/me/details', json=payload)
    assert result.status_code == 422
    assert not db.calls


def test_inactive_user_cannot_write_personal_data(api):
    db, client = api
    db.active = False
    result = client.patch('/api/v1/me/details', json={})
    assert result.status_code == 403
    assert not db.committed


def test_directory_enforces_tenant_and_makes_sensitive_fields_private(api):
    db, client = api
    result = client.get(f'/api/v1/directory/users/{USER}', params={'organization_id': str(ORG)})
    assert result.status_code == 200
    assert result.json()['country_code'] is None
    assert 'sex' not in result.json()
    assert 'birth_date' not in result.json()
    sql, parameters = db.calls[0]
    assert parameters == {'user_id': USER, 'organization_id': ORG, 'auth_id': ACTOR}
    assert "role.code='institution_admin'" in sql
    assert "gr.code='superadmin'" in sql
    assert 'p.birth_date' not in sql and 'p.sex' not in sql


def test_directory_rejects_unknown_or_out_of_scope(api):
    db, client = api
    db.directory = False
    result = client.get(f'/api/v1/directory/users/{USER}', params={'organization_id': str(ORG)})
    assert result.status_code == 404


def test_directory_requires_institution_context(api):
    db, client = api
    result = client.get(f'/api/v1/directory/users/{USER}')
    assert result.status_code == 422
    assert not db.calls
