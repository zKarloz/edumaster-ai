"""Regresiones de permisos de superadmin y membresías institucionales.

Simulamos la base de datos: las pruebas de integración reales se ejecutan en
la instalación del usuario, con su propio proyecto Supabase.
"""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

ACTOR = UUID("11111111-1111-4111-8111-111111111111")
ORG = UUID("22222222-2222-4222-8222-222222222222")
MEMBER = UUID("33333333-3333-4333-8333-333333333333")
ROLE = UUID("44444444-4444-4444-8444-444444444444")
AUTH = UUID("55555555-5555-4555-8555-555555555555")
USER = UUID("66666666-6666-4666-8666-666666666666")
URL = "/api/v1/admin/institution-admins"


class Result:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows if rows is not None else []

    def mappings(self):
        return self

    def first(self):
        return self.row

    def all(self):
        return self.rows

    def scalar_one(self):
        return self.row

    def scalar_one_or_none(self):
        return self.row


class Connection:
    def __init__(self, *, authorized=True, confirmed=True, org_exists=True,
                 member_exists=False, membership_status="active", already_admin=False,
                 admin_count=2, target_exists=True):
        self.authorized = authorized
        self.confirmed = confirmed
        self.org_exists = org_exists
        self.member_exists = member_exists
        self.membership_status = membership_status
        self.already_admin = already_admin
        self.admin_count = admin_count
        self.target_exists = target_exists
        self.statements = []

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.statements.append((sql, params))
        if "SELECT u.id FROM app.users u" in sql:
            return Result((ACTOR,) if self.authorized else None)
        if "FROM app.organization_memberships m\n    JOIN app.organizations" in sql:
            return Result(rows=[{
                "membership_id": str(MEMBER), "organization_id": str(ORG),
                "organization_name": "Institución DEMO", "user_id": str(USER),
                "full_name": "Administrador DEMO", "email": "admin@example.org",
                "status": "active", "granted_at": "2026-01-01T00:00:00Z",
            }])
        if "SELECT id FROM app.organizations" in sql:
            return Result((ORG,) if self.org_exists else None)
        if "SELECT id, email, email_confirmed_at" in sql:
            return Result({"id": AUTH, "email": "admin@example.org",
                           "email_confirmed_at": "2026-01-01T00:00:00Z" if self.confirmed else None,
                           "raw_user_meta_data": {"full_name": "Administrador DEMO"}})
        if "SELECT id, status FROM app.users" in sql:
            return Result({"id": USER, "status": "active"})
        if "SELECT id FROM app.roles" in sql:
            return Result(ROLE)
        if "SELECT id, status FROM app.organization_memberships" in sql:
            return Result({"id": MEMBER, "status": self.membership_status} if self.member_exists else None)
        if "SELECT 1 FROM app.membership_roles" in sql:
            return Result((1,) if self.already_admin else None)
        if "INSERT INTO app.organization_memberships" in sql:
            return Result(MEMBER)
        if "SELECT organization_id FROM app.organization_memberships" in sql:
            return Result({"organization_id": ORG} if self.target_exists else None)
        if "SELECT m.id FROM app.organization_memberships m" in sql:
            return Result((MEMBER,) if self.target_exists else None)
        if "SELECT COUNT(*) FROM app.organization_memberships" in sql:
            return Result(self.admin_count)
        return Result()


class Context:
    def __init__(self, engine):
        self.engine = engine

    async def __aenter__(self):
        return self.engine.connection

    async def __aexit__(self, exc_type, exc, tb):
        self.engine.rolled_back = exc is not None
        return False


class Engine:
    def __init__(self, **options):
        self.connection = Connection(**options)
        self.rolled_back = False

    def connect(self):
        return Context(self)

    def begin(self):
        return Context(self)


def request(method, endpoint="", engine=None, payload=None, with_auth=True):
    engine = engine or Engine()
    if with_auth:
        app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: engine
    try:
        with TestClient(app) as client:
            result = client.request(method, URL + endpoint, json=payload,
                                    headers={"Origin": "http://localhost:5173"})
    finally:
        app.dependency_overrides.clear()
    return result, engine


@pytest.mark.parametrize("method,endpoint", [("GET", ""), ("POST", ""), ("DELETE", f"/{MEMBER}")])
def test_admin_actions_require_jwt(method, endpoint):
    response, engine = request(method, endpoint, payload={"organization_id": str(ORG), "email": "admin@example.org"}, with_auth=False)
    assert response.status_code == 401
    assert not engine.connection.statements


@pytest.mark.parametrize("method,endpoint", [("GET", ""), ("POST", ""), ("DELETE", f"/{MEMBER}")])
def test_non_superadmin_has_no_access(method, endpoint):
    response, engine = request(method, endpoint, Engine(authorized=False),
                               {"organization_id": str(ORG), "email": "admin@example.org"})
    assert response.status_code == 403
    assert not any("FROM auth.users" in sql for sql, _ in engine.connection.statements)


def test_list_only_returns_institution_admins():
    response, engine = request("GET")
    assert response.status_code == 200
    assert response.json()["items"][0]["email"] == "admin@example.org"
    assert any("r.code = 'institution_admin'" in sql for sql, _ in engine.connection.statements)


def test_create_requires_confirmed_existing_auth_account():
    response, engine = request("POST", engine=Engine(confirmed=False), payload={
        "organization_id": str(ORG), "email": "ADMIN@EXAMPLE.ORG",
    })
    assert response.status_code == 422
    assert engine.rolled_back
    assert not any("INSERT INTO app.membership_roles" in sql for sql, _ in engine.connection.statements)


def test_create_fails_for_unknown_institution():
    response, engine = request("POST", engine=Engine(org_exists=False), payload={
        "organization_id": str(ORG), "email": "admin@example.org",
    })
    assert response.status_code == 404
    assert engine.rolled_back


def test_create_success_atomic_and_audited():
    response, engine = request("POST", payload={"organization_id": str(ORG),
        "email": "ADMIN@EXAMPLE.ORG", "reason": "Encargado DEMO"})
    assert response.status_code == 201, response.text
    sqls = [sql for sql, _ in engine.connection.statements]
    assert next(i for i, sql in enumerate(sqls) if "FOR UPDATE" in sql) < next(i for i, sql in enumerate(sqls) if "INSERT INTO app.membership_roles" in sql)
    assert any("INSERT INTO app.audit_logs" in sql for sql in sqls)
    assert engine.rolled_back is False
    auth_params = next(params for sql, params in engine.connection.statements if "FROM auth.users" in sql)
    assert auth_params["email"] == "admin@example.org"


def test_create_existing_member_does_not_duplicate_membership():
    response, engine = request("POST", engine=Engine(member_exists=True, already_admin=False),
                               payload={"organization_id": str(ORG), "email": "admin@example.org"})
    assert response.status_code == 201
    assert not any("INSERT INTO app.organization_memberships" in sql for sql, _ in engine.connection.statements)
    assert any("INSERT INTO app.membership_roles" in sql for sql, _ in engine.connection.statements)


def test_create_duplicate_is_conflict():
    response, engine = request("POST", engine=Engine(member_exists=True, already_admin=True),
                               payload={"organization_id": str(ORG), "email": "admin@example.org"})
    assert response.status_code == 409
    assert engine.rolled_back


def test_create_suspended_membership_requires_review():
    response, _ = request("POST", engine=Engine(member_exists=True, membership_status="suspended"),
                          payload={"organization_id": str(ORG), "email": "admin@example.org"})
    assert response.status_code == 409


def test_revoke_cannot_remove_last_active_admin():
    response, engine = request("DELETE", f"/{MEMBER}", Engine(admin_count=1))
    assert response.status_code == 409
    assert engine.rolled_back
    assert not any("DELETE FROM app.membership_roles" in sql for sql, _ in engine.connection.statements)


def test_revoke_removes_only_admin_role_and_audits():
    response, engine = request("DELETE", f"/{MEMBER}")
    assert response.status_code == 200, response.text
    statements = [sql for sql, _ in engine.connection.statements]
    assert any("DELETE FROM app.membership_roles" in sql for sql in statements)
    assert any("NOT EXISTS" in sql and "UPDATE app.organization_memberships" in sql for sql in statements)
    assert any("'revoke'" in sql and "INSERT INTO app.audit_logs" in sql for sql in statements)
    assert engine.rolled_back is False


def test_revocation_nonexistent_assignment():
    response, engine = request("DELETE", f"/{MEMBER}", Engine(target_exists=False))
    assert response.status_code == 404
    assert engine.rolled_back


def test_payload_cannot_choose_or_escalate_role():
    """Un cliente no puede solicitar un rol distinto modificando el JSON."""
    response, engine = request("POST", payload={
        "organization_id": str(ORG), "email": "admin@example.org", "role": "superadmin"
    })
    assert response.status_code == 422
    assert not engine.connection.statements
