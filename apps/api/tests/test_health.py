"""Pruebas básicas de endpoints públicos y de protección de rutas."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_profile_requires_auth() -> None:
    response = client.get('/api/v1/me')
    assert response.status_code == 401


def test_organizations_requires_auth() -> None:
    response = client.get('/api/v1/organizations')
    assert response.status_code == 401


def test_tenant_courses_requires_auth() -> None:
    response = client.get('/api/v1/organizations/00000000-0000-0000-0000-000000000001/courses')
    assert response.status_code == 401
