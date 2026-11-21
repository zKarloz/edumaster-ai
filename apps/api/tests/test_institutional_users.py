"""Regresiones RBAC/ABAC del módulo de miembros institucionales.

No depende de la base de datos real: valida decisiones de autorización, el orden
antes de escribir y el aislamiento de organización. El E2E se prueba en Supabase.
"""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import authenticated_user_id
from app.core.database import require_engine

ACTOR = UUID('11111111-1111-4111-8111-111111111111')
ORG = UUID('22222222-2222-4222-8222-222222222222')
OTHER_ORG = UUID('99999999-9999-4999-8999-999999999999')
MEMBER = UUID('33333333-3333-4333-8333-333333333333')
ROLE = UUID('44444444-4444-4444-8444-444444444444')
AUTH = UUID('55555555-5555-4555-8555-555555555555')
USER = UUID('66666666-6666-4666-8666-666666666666')
ROOT = f'/api/v1/institutional/organizations/{ORG}/members'


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


class FakeConnection:
    def __init__(self, *, manager=True, protected=False, member_status='active',
                 actor_is_target=False, confirmed=True, duplicate=False, other_roles=1,
                 active_enrollments=False, assigned_offerings=False, user_status='active',
                 member_exists=True, role_exists=True, org_exists=True, has_role=False, global_privilege=False):
        self.manager = manager
        self.protected = protected
        self.member_status = member_status
        self.actor_is_target = actor_is_target
        self.confirmed = confirmed
        self.duplicate = duplicate
        self.has_role = has_role
        self.global_privilege = global_privilege
        self.other_roles = other_roles
        self.active_enrollments = active_enrollments
        self.assigned_offerings = assigned_offerings
        self.user_status = user_status
        self.member_exists = member_exists
        self.role_exists = role_exists
        self.org_exists = org_exists
        self.statements = []

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        self.statements.append((sql, params))
        if 'SELECT u.id FROM app.users u' in sql and "r.code='institution_admin'" in sql:
            return Result((ACTOR,) if self.manager and params['organization_id'] == ORG else None)
        if 'SELECT id FROM app.organizations' in sql:
            return Result((ORG,) if self.org_exists else None)
        if 'SELECT m.id, m.user_id, m.status' in sql:
            return Result({ 'id': MEMBER, 'user_id': ACTOR if self.actor_is_target else USER,
                            'status': self.member_status, 'user_status': self.user_status,
                            'protected': self.protected } if self.member_exists else None)
        if 'FROM auth.users WHERE lower(email)' in sql:
            return Result({'id': AUTH, 'email_confirmed_at': '2026-01-01' if self.confirmed else None})
        if 'SELECT id, status FROM app.users' in sql:
            return Result({'id': ACTOR if self.actor_is_target else USER, 'status': self.user_status})
        if 'SELECT EXISTS (' in sql and 'FROM app.global_role_assignments gra' in sql:
            return Result(self.global_privilege)
        if 'SELECT id, status FROM app.organization_memberships' in sql:
            return Result({'id': MEMBER, 'status': self.member_status} if self.member_exists else None)
        if 'INSERT INTO app.organization_memberships' in sql:
            return Result(MEMBER)
        if 'SELECT id FROM app.roles' in sql:
            return Result(ROLE if self.role_exists else None)
        if 'SELECT COUNT(*) FROM app.membership_roles' in sql:
            return Result(self.other_roles)
        if 'SELECT 1 FROM app.membership_roles' in sql:
            return Result((1,) if (self.duplicate or self.has_role) else None)
        if 'SELECT 1 FROM app.enrollments e' in sql:
            return Result((1,) if self.active_enrollments else None)
        if 'SELECT 1 FROM app.course_offerings off' in sql:
            return Result((1,) if self.assigned_offerings else None)
        if 'SELECT m.id::text AS membership_id' in sql:
            return Result(rows=[{'membership_id': str(MEMBER), 'organization_id': str(ORG),
                'full_name': 'Persona DEMO', 'email': 'demo@example.org',
                'status': self.member_status, 'roles': ['student'],
                'is_protected': False, 'is_self': False}])
        return Result()


class Context:
    def __init__(self, engine):
        self.engine = engine

    async def __aenter__(self):
        return self.engine.conn

    async def __aexit__(self, exc_type, exc, tb):
        self.engine.rolled_back = exc is not None
        return False


class FakeEngine:
    def __init__(self, **kwargs):
        self.conn = FakeConnection(**kwargs)
        self.rolled_back = False

    def begin(self):
        return Context(self)

    def connect(self):
        return Context(self)


def call(method='GET', path='', engine=None, body=None, auth=True):
    engine = engine or FakeEngine(has_role=method == 'DELETE')
    app.dependency_overrides[require_engine] = lambda: engine
    if auth:
        app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    try:
        with TestClient(app) as client:
            response = client.request(method, ROOT + path, json=body,
                headers={'Origin': 'http://localhost:5173'})
    finally:
        app.dependency_overrides.clear()
    return response, engine


def payload(role='student'):
    return {'email': 'demo@example.org', 'full_name': 'Persona DEMO', 'role': role}


def statements(engine):
    return '\n'.join(sql for sql, _ in engine.conn.statements)


@pytest.mark.parametrize('method,path,body', [
    ('GET', '', None), ('POST', '', payload()),
    ('POST', f'/{MEMBER}/roles', {'role':'analyst'}),
    ('DELETE', f'/{MEMBER}/roles/student', None),
    ('PATCH', f'/{MEMBER}/status', {'status': 'suspended'}),
])
def test_all_routes_require_jwt(method, path, body):
    result, engine = call(method, path, body=body, auth=False)
    assert result.status_code == 401
    assert engine.conn.statements == []


@pytest.mark.parametrize('method,path,body', [
    ('GET', '', None), ('POST', '', payload()),
    ('POST', f'/{MEMBER}/roles', {'role':'analyst'}),
    ('DELETE', f'/{MEMBER}/roles/student', None),
    ('PATCH', f'/{MEMBER}/status', {'status': 'suspended'}),
])
def test_no_institution_admin_cannot_list_or_modify(method, path, body):
    response, engine = call(method, path, FakeEngine(manager=False), body)
    assert response.status_code == 403
    assert 'INSERT INTO' not in statements(engine)
    assert 'UPDATE app.' not in statements(engine)
    assert 'FROM auth.users' not in statements(engine)


def test_member_list_only_scoped_to_path_organization():
    response, engine = call()
    assert response.status_code == 200
    assert response.json()['items'][0]['email'] == 'demo@example.org'
    list_calls = [(sql, params) for sql,params in engine.conn.statements if 'LIMIT 500' in sql]
    assert len(list_calls) == 1
    assert list_calls[0][1]['organization_id'] == ORG
    assert 'WHERE m.organization_id=:organization_id' in list_calls[0][0]


def test_cannot_use_foreign_institution_id():
    other = f'/api/v1/institutional/organizations/{OTHER_ORG}/members'
    engine = FakeEngine()
    app.dependency_overrides[require_engine] = lambda: engine
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    try:
        with TestClient(app) as client:
            result = client.post(other, json=payload())
    finally:
        app.dependency_overrides.clear()
    assert result.status_code == 403
    assert 'INSERT INTO' not in statements(engine)


@pytest.mark.parametrize('role', ['superadmin', 'institution_admin', 'auditor', 'root'])
def test_reserved_roles_not_delegable(role):
    response, engine = call('POST', body=payload(role))
    assert response.status_code == 422
    assert engine.conn.statements == []


@pytest.mark.parametrize('role', ['coordinator', 'instructor', 'student', 'analyst', 'ml_engineer'])
def test_allowed_first_roles_and_auditing(role):
    response, engine = call('POST', engine=FakeEngine(member_exists=False), body=payload(role))
    assert response.status_code == 201, response.text
    assert 'INSERT INTO app.membership_roles' in statements(engine)
    assert 'INSERT INTO app.audit_logs' in statements(engine)
    if role == 'student':
        assert 'INSERT INTO app.students' in statements(engine)
    if role == 'instructor':
        assert 'INSERT INTO app.instructors' in statements(engine)
    assert not engine.rolled_back


def test_account_must_have_confirmed_email():
    response, engine = call('POST', engine=FakeEngine(confirmed=False), body=payload())
    assert response.status_code == 422
    assert 'INSERT INTO app.users' not in statements(engine)
    assert engine.rolled_back


def test_suspended_account_cannot_receive_role_in_add():
    response, engine = call('POST', engine=FakeEngine(member_status='suspended'), body=payload())
    assert response.status_code == 409
    assert 'INSERT INTO app.membership_roles' not in statements(engine)


def test_protected_administrator_cannot_receive_role():
    response, engine = call('POST', engine=FakeEngine(protected=True), body=payload())
    assert response.status_code == 403
    assert 'INSERT INTO app.membership_roles' not in statements(engine)


def test_same_role_cannot_be_assigned_twice():
    response, engine = call('POST', engine=FakeEngine(duplicate=True), body=payload())
    assert response.status_code == 409
    assert 'INSERT INTO app.membership_roles' not in statements(engine)


def test_grant_role_cannot_modify_self_or_protected_member():
    for engine in (FakeEngine(actor_is_target=True), FakeEngine(protected=True)):
        response, used = call('POST', f'/{MEMBER}/roles', engine=engine, body={'role': 'analyst'})
        assert response.status_code == 403
        assert 'INSERT INTO app.membership_roles' not in statements(used)


def test_grant_secondary_role():
    response, engine = call('POST', f'/{MEMBER}/roles', body={'role': 'student'})
    assert response.status_code == 200
    assert 'INSERT INTO app.students' in statements(engine)


def test_cannot_remove_last_role():
    response, engine = call('DELETE', f'/{MEMBER}/roles/student', engine=FakeEngine(other_roles=0, has_role=True))
    assert response.status_code == 409
    assert 'DELETE FROM app.membership_roles' not in statements(engine)


def test_cannot_remove_student_with_active_enrollment():
    response, engine = call('DELETE', f'/{MEMBER}/roles/student', engine=FakeEngine(active_enrollments=True, has_role=True))
    assert response.status_code == 409
    assert 'DELETE FROM app.membership_roles' not in statements(engine)


def test_cannot_remove_instructor_with_live_offering():
    response, engine = call('DELETE', f'/{MEMBER}/roles/instructor', engine=FakeEngine(assigned_offerings=True, has_role=True))
    assert response.status_code == 409
    assert 'DELETE FROM app.membership_roles' not in statements(engine)


def test_successful_role_removal_updates_profile_and_audits():
    response, engine = call('DELETE', f'/{MEMBER}/roles/student')
    assert response.status_code == 200
    assert "UPDATE app.students SET status='inactive'" in statements(engine)
    assert 'INSERT INTO app.audit_logs' in statements(engine)


def test_suspension_preserves_role_and_audits():
    response, engine = call('PATCH', f'/{MEMBER}/status', body={'status': 'suspended'})
    assert response.status_code == 200
    assert 'UPDATE app.organization_memberships SET status=:status' in statements(engine)
    assert 'DELETE FROM app.membership_roles' not in statements(engine)


def test_suspended_member_can_be_reactivated():
    response, engine = call('PATCH', f'/{MEMBER}/status', engine=FakeEngine(member_status='suspended'), body={'status': 'active'})
    assert response.status_code == 200
    assert 'UPDATE app.organization_memberships' in statements(engine)


def test_admin_cannot_suspend_admin_or_self():
    for engine in (FakeEngine(protected=True), FakeEngine(actor_is_target=True)):
        response, used = call('PATCH', f'/{MEMBER}/status', engine, {'status': 'suspended'})
        assert response.status_code == 403
        assert 'UPDATE app.organization_memberships' not in statements(used)


def test_local_admin_cannot_assign_to_global_privileged_account():
    response, engine = call('POST', engine=FakeEngine(global_privilege=True), body=payload('student'))
    assert response.status_code == 403
    assert 'INSERT INTO app.organization_memberships' not in statements(engine)
