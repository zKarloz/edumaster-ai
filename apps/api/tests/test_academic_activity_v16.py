"""Seguridad y validación del incremento v16, sin conectarse a Supabase real."""
from datetime import date
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app
from app.routers.academic_activity import (
    ActivityCreate,
    EnrollmentStatusUpdate,
    ProgressUpdate,
)

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
OFFER = UUID("33333333-3333-4333-8333-333333333333")
ENROLL = UUID("44444444-4444-4444-8444-444444444444")
STUDENT = UUID("55555555-5555-4555-8555-555555555555")
COURSE = UUID("66666666-6666-4666-8666-666666666666")
RECORD = UUID("77777777-7777-4777-8777-777777777777")
ROOT = f"/api/v1/academic/organizations/{ORG}"


class Result:
    def __init__(self, row=None, rows=None):
        self.row, self.rows = row, rows or []

    def mappings(self):
        return self

    def first(self):
        return self.row

    def scalar_one(self):
        return self.row

    def all(self):
        return self.rows


class FakeConnection:
    def __init__(self, *, manager=True, assigned=False, accessible=True, active=True,
                 offering=True, current="active"):
        self.manager, self.assigned, self.accessible = manager, assigned, accessible
        self.active, self.offering, self.current = active, offering, current
        self.statements = []

    async def execute(self, statement, params=None):
        query = str(statement)
        self.statements.append((query, params))
        if "AS is_global_admin" in query:
            return Result({"actor_id": ACTOR, "is_global_admin": False,
                           "is_member": self.accessible, "is_manager": self.manager})
        if "AS assigned" in query and "FROM app.course_offerings off" in query:
            return Result({"id": OFFER, "assigned": self.assigned} if self.offering else None)
        if "FOR UPDATE OF e" in query:
            if "AS offering_status" in query:
                return Result({"id": ENROLL, "status": self.current,
                               "offering_status": "open", "student_status": "active",
                               "membership_status": "active", "user_status": "active"})
            return Result({"id": ENROLL, "student_id": STUDENT, "course_id": COURSE,
                           "status": "active" if self.active else "withdrawn"})
        if "INSERT INTO app.academic_activity_records" in query:
            return Result(RECORD)
        if "INSERT INTO app.progress_snapshots" in query:
            return Result(RECORD)
        if "FROM app.academic_activity_records a" in query and "FOR UPDATE OF a" in query:
            return Result({"id": RECORD, "enrollment_id": ENROLL})
        if "FROM app.course_offerings" in query and "FOR UPDATE" in query:
            return Result((1,) if self.offering else None)
        if "FROM app.instructors i" in query and "SELECT 1" in query:
            return Result((1,) if self.assigned else None)
        return Result(rows=[])


class Context:
    def __init__(self, engine):
        self.engine = engine

    async def __aenter__(self):
        return self.engine.conn

    async def __aexit__(self, exc_type, exc, tb):
        self.engine.rolled_back = exc is not None
        return False


class Engine:
    def __init__(self, **kwargs):
        self.conn = FakeConnection(**kwargs)
        self.rolled_back = False

    def begin(self):
        return Context(self)

    def connect(self):
        return Context(self)


def call(method, path, engine=None, payload=None):
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: engine or Engine()
    try:
        with TestClient(app) as client:
            return client.request(method, ROOT + path, json=payload)
    finally:
        app.dependency_overrides.clear()


def body(kind="grade"):
    data = {"enrollment_id": str(ENROLL), "kind": kind, "title": "Examen 1",
            "activity_date": str(date.today())}
    if kind == "grade":
        data.update(score=18, max_score=20)
    elif kind == "attendance":
        data["attendance_status"] = "present"
    else:
        data["participation_rating"] = 4
    return data


@pytest.mark.parametrize("kind", ["grade", "attendance", "participation"])
def test_activity_variants_are_valid(kind):
    assert ActivityCreate.model_validate(body(kind)).kind == kind


@pytest.mark.parametrize("changes", [
    {"score": 25, "max_score": 20},
    {"score": -1},
    {"score": 10, "attendance_status": "present"},
    {"score": None},
    {"kind": "attendance", "score": None, "max_score": None, "attendance_status": None},
    {"kind": "participation", "score": None, "max_score": None, "participation_rating": 6},
])
def test_invalid_records_rejected_at_validation(changes):
    with pytest.raises(ValidationError):
        ActivityCreate.model_validate({**body(), **changes})


def test_future_academic_evidence_rejected():
    from datetime import timedelta

    with pytest.raises(ValidationError):
        ActivityCreate.model_validate({**body(), "activity_date": str(date.today() + timedelta(days=1))})


def test_progress_is_bounded():
    assert ProgressUpdate(enrollment_id=ENROLL, completion_percent=100).completion_percent == 100
    with pytest.raises(ValidationError):
        ProgressUpdate(enrollment_id=ENROLL, completion_percent=101)


def test_enrollment_status_rejects_unrecognized_value():
    with pytest.raises(ValidationError):
        EnrollmentStatusUpdate(status="suspended")


def test_requests_require_jwt():
    with TestClient(app) as client:
        assert client.get(ROOT + "/activity/offerings").status_code == 401
        assert client.post(ROOT + f"/activity/offerings/{OFFER}/records", json=body()).status_code == 401


def test_cross_institution_is_masked():
    res = call("GET", "/activity/offerings", Engine(accessible=False))
    assert res.status_code == 404


def test_unassigned_teacher_cannot_view_or_write_an_offering():
    engine = Engine(manager=False, assigned=False)
    endpoint = f"/activity/offerings/{OFFER}"
    assert call("GET", endpoint + "/overview", engine).status_code == 403
    assert call("POST", endpoint + "/records", engine, body()).status_code == 403
    assert not any("INSERT INTO app.academic_activity_records" in sql for sql, _ in engine.conn.statements)


def test_assigned_teacher_can_register_activity_and_audit_it():
    engine = Engine(manager=False, assigned=True)
    res = call("POST", f"/activity/offerings/{OFFER}/records", engine, body())
    assert res.status_code == 201, res.text
    statements = engine.conn.statements
    insert = next(params for sql, params in statements if "INSERT INTO app.academic_activity_records" in sql)
    assert insert["organization_id"] == ORG
    assert insert["enrollment_id"] == ENROLL
    assert any("INSERT INTO app.learning_events" in sql for sql, _ in statements)
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in statements)
    assert engine.rolled_back is False


def test_inactive_enrollment_is_not_writable():
    engine = Engine(active=False)
    result = call("POST", f"/activity/offerings/{OFFER}/records", engine, body())
    assert result.status_code == 409
    assert engine.rolled_back
    assert not any("INSERT INTO app.academic_activity_records" in sql for sql, _ in engine.conn.statements)


def test_progress_updates_same_tenant_snapshot():
    engine = Engine(manager=False, assigned=True)
    res = call("PUT", f"/activity/offerings/{OFFER}/progress", engine,
               {"enrollment_id": str(ENROLL), "completion_percent": 35.5})
    assert res.status_code == 200, res.text
    sql, params = next((sql, params) for sql, params in engine.conn.statements
                       if "INSERT INTO app.progress_snapshots" in sql)
    assert "ON CONFLICT (organization_id, student_id, offering_id)" in sql
    assert params["organization_id"] == ORG


def test_only_manager_changes_enrollment_status():
    res = call("PATCH", f"/enrollments/{ENROLL}/status", Engine(manager=False),
               {"status": "withdrawn"})
    assert res.status_code == 403


def test_completed_enrollment_is_terminal():
    res = call("PATCH", f"/enrollments/{ENROLL}/status", Engine(current="completed"),
               {"status": "active"})
    assert res.status_code == 409


def test_manager_can_withdraw_enrollment_with_audit():
    engine = Engine()
    res = call("PATCH", f"/enrollments/{ENROLL}/status", engine, {"status": "withdrawn"})
    assert res.status_code == 200, res.text
    assert any("UPDATE app.enrollments SET status" in sql for sql, _ in engine.conn.statements)
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in engine.conn.statements)


def test_only_manager_can_assign_instructor():
    res = call("PUT", f"/offerings/{OFFER}/instructor", Engine(manager=False),
               {"instructor_id": str(STUDENT)})
    assert res.status_code == 403


def test_unverified_instructor_rejected():
    res = call("PUT", f"/offerings/{OFFER}/instructor", Engine(assigned=False),
               {"instructor_id": str(STUDENT)})
    assert res.status_code == 422


def test_own_offerings_disables_manager_bypass():
    engine = Engine(manager=True, assigned=True)
    assert call('GET', '/activity/offerings?own=true', engine).status_code == 200
    sql, params = engine.conn.statements[-1]
    assert 'm.user_id=:actor' in sql
    assert params['manager'] is False
    assert params['actor'] == ACTOR
