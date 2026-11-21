"""Pruebas de seguridad y validación del mapa internacional.

No escriben en Supabase ni requieren conexión remota.
"""
from uuid import UUID

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import require_engine
from app.core.security import authenticated_user_id

client = TestClient(app)

PAYLOAD = {
    "code": "pe-instituto_demo_lima", "name": "Instituto DEMO Lima",
    "timezone": "America/Lima", "country_code": "PE", "city": "Lima",
    "address": None, "latitude": -12.05, "longitude": -77.04,
}


def test_post_requires_token() -> None:
    assert client.post('/api/v1/organizations', json=PAYLOAD).status_code == 401


def test_put_requires_token() -> None:
    assert client.put('/api/v1/organizations/00000000-0000-0000-0000-000000000001',
                      json=PAYLOAD).status_code == 401


def test_out_of_bounds_is_rejected() -> None:
    from app.routers.organizations import OrganizationCreate
    from pydantic import ValidationError
    try:
        OrganizationCreate(**{**PAYLOAD, 'latitude': 130})
    except ValidationError:
        pass
    else:
        raise AssertionError('Se admitieron coordenadas inválidas')


def test_invalid_timezone_is_rejected() -> None:
    from app.routers.organizations import OrganizationCreate
    from pydantic import ValidationError
    try:
        OrganizationCreate(**{**PAYLOAD, 'timezone': 'NoEsZona/Inventada'})
    except ValidationError:
        pass
    else:
        raise AssertionError('Se admitió una zona horaria inventada')


class _EmptyResult:
    def first(self):
        return None


class _Connection:
    async def execute(self, *_args, **_kwargs):
        return _EmptyResult()


class _Transaction:
    async def __aenter__(self):
        return _Connection()

    async def __aexit__(self, *_args):
        return False


class _Engine:
    def begin(self):
        return _Transaction()


def test_authenticated_user_without_superadmin_cannot_create() -> None:
    app.dependency_overrides[authenticated_user_id] = lambda: UUID('00000000-0000-0000-0000-000000000010')
    app.dependency_overrides[require_engine] = lambda: _Engine()
    try:
        response = client.post('/api/v1/organizations', json=PAYLOAD)
        assert response.status_code == 403, response.text
    finally:
        app.dependency_overrides.clear()
