"""Regresiones de CAMBIOS 9: aislamiento y paginación, sin PostgreSQL remoto."""
from uuid import UUID

from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
OFFER = UUID("33333333-3333-4333-8333-333333333333")
ENROLL = UUID("44444444-4444-4444-8444-444444444444")
ROOT = f"/api/v1/academic/organizations/{ORG}"


class Result:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def mappings(self):
        return self

    def scalars(self):
        return self

    def first(self):
        return self.row

    def scalar_one(self):
        return self.row

    def all(self):
        return self.rows


class Connection:
    def __init__(self, manager=True, accessible=True, assigned=False, enrolled=True):
        self.manager = manager
        self.accessible = accessible
        self.assigned = assigned
        self.enrolled = enrolled
        self.statements = []

    async def execute(self, statement, params=None):
        query = str(statement)
        self.statements.append((query, params))
        if "AS is_global_admin" in query:
            return Result({"actor_id": ACTOR, "is_global_admin": False,
                           "is_member": self.accessible, "is_manager": self.manager})
        if "AS assigned" in query and "FROM app.course_offerings off" in query:
            return Result({"id": OFFER, "assigned": self.assigned})
        if "SELECT 1 FROM app.enrollments" in query:
            return Result((1,) if self.enrolled else None)
        if "SELECT COUNT(*)" in query:
            return Result(0)
        return Result(rows=[])


class Context:
    def __init__(self, connection):
        self.conn = connection

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *_args):
        return False


class Engine:
    def __init__(self, **kwargs):
        self.conn = Connection(**kwargs)

    def connect(self):
        return Context(self.conn)


def call(path, engine):
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: engine
    try:
        with TestClient(app) as client:
            return client.get(ROOT + path)
    finally:
        app.dependency_overrides.clear()


def test_manager_only_organization_offerings():
    response = call("/course-offerings", Engine(manager=False))
    assert response.status_code == 403


def test_cross_tenant_cannot_list_own_courses():
    response = call("/my-courses", Engine(accessible=False))
    assert response.status_code == 404


def test_student_course_list_uses_jwt_identity_not_request_student_id():
    engine = Engine(manager=False)
    response = call("/my-courses?enrollment_status=completed&limit=5&offset=10", engine)
    assert response.status_code == 200, response.text
    queries = [(sql, values) for sql, values in engine.conn.statements if "FROM app.enrollments e" in sql]
    assert queries
    for sql, values in queries:
        assert "u.auth_user_id=:auth_id" in sql
        assert "e.organization_id=:organization_id" in sql
        assert values["auth_id"] == ACTOR
        assert values["enrollment_status"] == "completed"
    assert any(values.get("offset") == 10 for _, values in queries)


def test_invalid_course_pagination_rejected():
    assert call("/my-courses?limit=1000", Engine()).status_code == 422
    assert call("/course-offerings?offering_status=completed", Engine()).status_code == 422


def test_record_history_requires_selected_enrollment():
    assert call(f"/activity/offerings/{OFFER}/records", Engine()).status_code == 422


def test_unassigned_teacher_cannot_read_student_history():
    endpoint = f"/activity/offerings/{OFFER}/records?enrollment_id={ENROLL}"
    response = call(endpoint, Engine(manager=False, assigned=False))
    assert response.status_code == 403


def test_history_rejects_enrollment_from_other_offering():
    endpoint = f"/activity/offerings/{OFFER}/records?enrollment_id={ENROLL}"
    response = call(endpoint, Engine(manager=False, assigned=True, enrolled=False))
    assert response.status_code == 404


def test_history_pagination_and_filters_apply_to_sql():
    engine = Engine(manager=False, assigned=True)
    endpoint = f"/activity/offerings/{OFFER}/records?enrollment_id={ENROLL}&kind=grade&limit=7&offset=14"
    response = call(endpoint, engine)
    assert response.status_code == 200, response.text
    assert response.json() == {"items": [], "total": 0, "limit": 7, "offset": 14}
    queries = [(sql, values) for sql, values in engine.conn.statements
               if "FROM app.academic_activity_records a" in sql]
    assert queries
    for sql, values in queries:
        assert "e.id=:enrollment_id" in sql
        assert "e.offering_id=:offering_id" in sql
        assert "a.voided_at IS NULL" in sql
        assert values["enrollment_id"] == ENROLL
        assert values["kind"] == "grade"
    assert any(values.get("limit") == 7 and values.get("offset") == 14 for _, values in queries)


def test_history_limit_bounds_and_type_validation():
    base = f"/activity/offerings/{OFFER}/records?enrollment_id={ENROLL}"
    assert call(base + "&limit=200", Engine()).status_code == 422
    assert call(base + "&kind=unknown", Engine()).status_code == 422
