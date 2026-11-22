"""Regresiones del alta institucional (no necesita una BD de Supabase).

La consulta de auditoría debe tipar explícitamente el código del país para
asyncpg y los errores SQL deben entregar una respuesta CORS interpretable.
"""
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.exc import ProgrammingError

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

ORIGIN = "http://localhost:5173"
ACTOR = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
ORGANIZATION = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
PAYLOAD = {
    "code": "pe-unmsm-demo",
    "name": "Institución de prueba de Lima",
    "timezone": "America/Lima",
    "country_code": "PE",
    "city": "Lima",
    "address": "Sede de prueba",
    "latitude": -12.0464,
    "longitude": -77.0428,
}


class _Result:
    """Respuesta mínima para simular las filas de RETURNING."""
    def __init__(self, row=None):
        self.row = row

    def first(self):
        return self.row


class _Connection:
    def __init__(self, fail_audit: bool = False):
        self.sql = []
        self.fail_audit = fail_audit

    async def execute(self, sql, params):
        query = str(sql)
        self.sql.append((query, params))
        if "SELECT u.id FROM app.users" in query:
            return _Result((ACTOR,))
        if "INSERT INTO app.organizations" in query:
            return _Result((ORGANIZATION,))
        if "INSERT INTO app.audit_logs" in query and self.fail_audit:
            raise ProgrammingError(query, params, Exception("Error simulado de base de datos"))
        return _Result()


class _Transaction:
    def __init__(self, engine):
        self.engine = engine

    async def __aenter__(self):
        return self.engine.conn

    async def __aexit__(self, exc_type, exc, tb):
        self.engine.rolled_back = exc_type is not None
        return False


class _Engine:
    def __init__(self, fail_audit: bool = False):
        self.conn = _Connection(fail_audit=fail_audit)
        self.rolled_back = False

    def begin(self):
        return _Transaction(self)


def _post(engine: _Engine):
    """Activa las dependencias simuladas solo mientras dura la petición."""
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: engine
    try:
        with TestClient(app) as client:
            return client.post("/api/v1/organizations", json=PAYLOAD,
                               headers={"Origin": ORIGIN})
    finally:
        app.dependency_overrides.clear()


def test_institution_audit_explicitly_casts_country_code() -> None:
    engine = _Engine()
    response = _post(engine)
    assert response.status_code == 201, response.text
    assert response.json()["id"] == str(ORGANIZATION)
    assert response.headers["access-control-allow-origin"] == ORIGIN
    audit_sql = next(sql for sql, _ in engine.conn.sql if "INSERT INTO app.audit_logs" in sql)
    assert "CAST(:country_code AS text)" in audit_sql
    assert len(engine.conn.sql) == 4
    assert engine.rolled_back is False


def test_sql_failure_returns_controlled_cors_response() -> None:
    engine = _Engine(fail_audit=True)
    response = _post(engine)
    assert response.status_code == 503
    assert "error de base de datos" in response.json()["detail"]
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert engine.rolled_back is True


def test_rejects_legacy_code_when_creating_new_institution() -> None:
    """El formato histórico puede existir en BD, pero no admite nuevas altas."""
    import pytest
    from pydantic import ValidationError

    from app.routers.organizations import OrganizationCreate

    with pytest.raises(ValidationError):
        OrganizationCreate(**{**PAYLOAD, "code": "instituto-lima"})


def test_rejects_code_with_wrong_country_prefix() -> None:
    """El prefijo ISO no debe contradecir el país declarado."""
    import pytest
    from pydantic import ValidationError

    from app.routers.organizations import OrganizationCreate

    with pytest.raises(ValidationError, match="debe comenzar por pe-"):
        OrganizationCreate(**{**PAYLOAD, "code": "co-unmsm-demo"})


def test_accepts_international_institution_codes() -> None:
    """Cuatro países, una única convención de código institucional."""
    from app.routers.organizations import OrganizationCreate

    for country, code in (("PE", "pe-unmsm"), ("CO", "co-unal"), ("MX", "mx-unam"), ("ES", "es-ucm")):
        result = OrganizationCreate(**{**PAYLOAD, "country_code": country, "code": code})
        assert result.country_code == country
        assert result.code == code
