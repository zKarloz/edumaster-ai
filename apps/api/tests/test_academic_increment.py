"""Regresiones de aislamiento y autorización del núcleo académico.

No se conecta a la base de datos real. La comprobación de integración con Supabase
se realizará desde VSCode tras aplicar el parche.
"""
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app
from app.routers.academic import CourseCreate, StudentCreate

ORG = UUID('11111111-1111-4111-8111-111111111111')
ACTOR = UUID('22222222-2222-4222-8222-222222222222')
COURSE = UUID('33333333-3333-4333-8333-333333333333')
OFFERING = UUID('44444444-4444-4444-8444-444444444444')
STUDENT = UUID('55555555-5555-4555-8555-555555555555')
URL = f'/api/v1/academic/organizations/{ORG}'
ORIGIN = 'http://localhost:5173'


class Result:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def mappings(self):
        return self

    def first(self):
        return self.row

    def scalar_one(self):
        return self.row

    def all(self):
        return self.rows


class FakeConnection:
    def __init__(self, *, manager=True, accessible=True, available=False, global_admin=False):
        self.manager = manager
        self.global_admin = global_admin
        self.accessible = accessible
        self.available = available
        self.statements = []

    async def execute(self, statement, params=None):
        query = str(statement)
        self.statements.append((query, params))
        if 'AS is_global_admin' in query:
            return Result({'actor_id': ACTOR, 'is_global_admin': self.global_admin,
                           'is_member': self.accessible, 'is_manager': self.manager})
        if 'INSERT INTO app.courses' in query:
            return Result(COURSE)
        if 'INSERT INTO app.course_offerings' in query:
            return Result(OFFERING)
        if 'SELECT 1 FROM app.course_offerings off' in query:
            return Result((1,) if self.available else None)
        if 'FROM auth.users' in query:
            return Result(None)
        if 'INSERT INTO app.enrollments' in query:
            return Result(UUID('66666666-6666-4666-8666-666666666666'))
        return Result()


class FakeContext:
    def __init__(self, engine):
        self.engine = engine

    async def __aenter__(self):
        return self.engine.connection

    async def __aexit__(self, exc_type, exc, tb):
        self.engine.rolled_back = exc is not None
        return False


class FakeEngine:
    def __init__(self, **kwargs):
        self.connection = FakeConnection(**kwargs)
        self.rolled_back = False

    def begin(self):
        return FakeContext(self)

    def connect(self):
        return FakeContext(self)


def call(method, endpoint, engine=None, payload=None):
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: engine or FakeEngine()
    try:
        with TestClient(app) as client:
            return client.request(method, URL + endpoint, json=payload,
                                  headers={'Origin': ORIGIN})
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize('endpoint', ['/courses', '/students', '/enrollments'])
def test_academic_write_requires_authentication(endpoint):
    with TestClient(app) as client:
        response = client.post(URL + endpoint, json={})
    assert response.status_code == 401


@pytest.mark.parametrize('endpoint,body', [
    ('/courses', {'code': 'mat-101', 'title': 'Matemáticas', 'period': '2026-II'}),
    ('/students', {'email': 'demo@example.com', 'full_name': 'Estudiante Demo'}),
    ('/enrollments', {'offering_id': str(OFFERING), 'student_id': str(STUDENT)}),
])
def test_institution_member_cannot_write_without_manager_role(endpoint, body):
    response = call('POST', endpoint, FakeEngine(manager=False), body)
    assert response.status_code == 403, response.text
    assert response.headers['access-control-allow-origin'] == ORIGIN


def test_different_organization_is_not_disclosed():
    response = call('GET', '/courses', FakeEngine(accessible=False))
    assert response.status_code == 404


def test_course_creates_offering_in_same_transaction():
    engine = FakeEngine()
    response = call('POST', '/courses', engine, {
        'code': 'MAT-101', 'title': 'Matemáticas DEMO', 'period': '2026-II',
    })
    assert response.status_code == 201, response.text
    statements = engine.connection.statements
    assert any('INSERT INTO app.courses' in sql for sql, _ in statements)
    assert any('INSERT INTO app.course_offerings' in sql for sql, _ in statements)
    offering = next(params for sql, params in statements if 'INSERT INTO app.course_offerings' in sql)
    assert offering['offering_status'] == 'open'
    assert offering['organization_id'] == ORG
    assert engine.rolled_back is False


def test_draft_course_creates_planned_offering():
    engine = FakeEngine()
    response = call('POST', '/courses', engine, {
        'code': 'mat-102', 'title': 'Curso borrador', 'period': '2026-II', 'status': 'draft',
    })
    assert response.status_code == 201
    assert next(params for sql, params in engine.connection.statements if 'INSERT INTO app.course_offerings' in sql)['offering_status'] == 'planned'


def test_student_requires_confirmed_supabase_identity():
    engine = FakeEngine()
    response = call('POST', '/students', engine, {
        'email': 'alumno@example.com', 'full_name': 'Alumno de prueba',
    })
    assert response.status_code == 422
    assert 'confirmada' in response.json()['detail']
    assert engine.rolled_back is True


def test_enrollment_rejects_cross_tenant_or_closed_offering():
    engine = FakeEngine(available=False)
    response = call('POST', '/enrollments', engine, {
        'offering_id': str(OFFERING), 'student_id': str(STUDENT),
    })
    assert response.status_code == 422
    assert engine.rolled_back is True
    sql = next(sql for sql, _ in engine.connection.statements if 'SELECT 1 FROM app.course_offerings off' in sql)
    assert 's.organization_id=off.organization_id' in sql
    assert 'off.organization_id=:organization_id' in sql
    assert "off.status='open'" in sql


def test_academic_student_directory_is_manager_only():
    response = call('GET', '/students', FakeEngine(manager=False))
    assert response.status_code == 403


def test_course_code_is_normalized_and_rejects_invalid():
    assert CourseCreate(code='MAT-101', title='Matemáticas', period='2026-II').code == 'mat-101'
    with pytest.raises(ValidationError):
        CourseCreate(code='*?', title='Matemáticas', period='2026-II')
    with pytest.raises(ValidationError):
        StudentCreate(email='sin_correo', full_name='Alumno Demo')


def test_enrollment_insert_happens_only_after_validation():
    engine = FakeEngine(available=True)
    response = call('POST', '/enrollments', engine, {
        'offering_id': str(OFFERING), 'student_id': str(STUDENT),
    })
    assert response.status_code == 201, response.text
    statements = engine.connection.statements
    validated_at = next(i for i, (sql, _) in enumerate(statements) if 'SELECT 1 FROM app.course_offerings off' in sql)
    inserted_at = next(i for i, (sql, _) in enumerate(statements) if 'INSERT INTO app.enrollments' in sql)
    assert validated_at < inserted_at
    assert engine.rolled_back is False


def test_list_courses_for_member_without_management_permission():
    engine = FakeEngine(manager=False)
    response = call('GET', '/courses', engine)
    assert response.status_code == 200, response.text
    assert response.json()['items'] == []
    queries = [(sql, params) for sql, params in engine.connection.statements if 'FROM app.courses c' in sql]
    assert len(queries) == 1
    assert queries[0][1]['can_manage'] is False


def test_authenticated_user_without_institution_cannot_view_students():
    assert call('GET', '/students', FakeEngine(accessible=False)).status_code == 404


def test_global_superadmin_is_not_an_academic_manager_by_default():
    """El rol global no otorga automáticamente el derecho a crear cursos."""
    engine = FakeEngine(manager=False, accessible=False, global_admin=True)
    response = call('POST', '/courses', engine, {
        'code': 'mat-103', 'title': 'Curso prueba', 'period': '2026-II',
    })
    assert response.status_code == 403, response.text
    assert not any('INSERT INTO app.courses' in sql for sql, _ in engine.connection.statements)


def test_global_superadmin_can_consult_published_courses_without_managing():
    engine = FakeEngine(manager=False, accessible=False, global_admin=True)
    response = call('GET', '/courses', engine)
    assert response.status_code == 200
    query = next(params for sql, params in engine.connection.statements if 'FROM app.courses c' in sql)
    assert query['can_manage'] is False
