"""CAMBIOS 21 v30.1: contratos, permisos y concurrencia sin datos reales.

Las pruebas SQL de integración requieren Supabase y se ejecutan en postflight.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.routers import course_tasks as tasks

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
OFFER = UUID("33333333-3333-4333-8333-333333333333")
TASK = UUID("44444444-4444-4444-8444-444444444444")
ENROLLMENT = UUID("55555555-5555-4555-8555-555555555555")
SUBMISSION = UUID("66666666-6666-4666-8666-666666666666")


def scope(*, editor=False, enrolled=True, state="active", course="published",
          offering="open"):
    return {"editor": editor, "actor": ACTOR,
            "enrollment_id": ENROLLMENT if enrolled else None,
            "enrollment_status": state if enrolled else None,
            "course_status": course, "offering_status": offering}


def assignment(**kwargs):
    return {"id": TASK, "status": "published", "due_at": None,
            "title": "Ejercicio", "instructions": "Escribe un resumen del tema.",
            "max_attempts": 2, "published_at": datetime.now(UTC)} | kwargs


@pytest.mark.parametrize("overrides", [
    {"title": "ab"}, {"instructions": "breve"}, {"max_attempts": 0},
    {"max_attempts": 11}, {"due_at": "2026-11-25T10:00:00"},
])
def test_task_input_rejects_invalid(overrides):
    data = {"title": "Tarea de práctica", "instructions": "Explica tu respuesta aquí.",
            "due_at": "2026-11-25T10:00:00-05:00", "max_attempts": 2} | overrides
    with pytest.raises(ValidationError):
        tasks.TaskInput.model_validate(data)


def test_task_input_accepts_timezone():
    value = tasks.TaskInput(title="Ejercicio corto", instructions="Responde con fundamentos.",
                            due_at="2026-11-25T10:00:00-05:00")
    assert value.due_at.utcoffset() == timedelta(hours=-5)


@pytest.mark.parametrize("model,value", [
    (tasks.AnswerInput, {"answer_text": "x" * 10001}),
    (tasks.ReviewInput, {"review_notes": "!"}),
    (tasks.ReviewInput, {"review_notes": "x" * 3001}),
])
def test_text_limits(model, value):
    with pytest.raises(ValidationError):
        model.model_validate(value)


def test_student_submit_eligible():
    tasks._can_submit(scope(), assignment())


@pytest.mark.parametrize("ctx,task,code", [
    (scope(enrolled=False), assignment(), 403),
    (scope(state="completed"), assignment(), 409),
    (scope(course="draft"), assignment(), 409),
    (scope(offering="closed"), assignment(), 409),
    (scope(), assignment(status="draft"), 409),
    (scope(), assignment(status="closed"), 409),
    (scope(), assignment(due_at=datetime.now(UTC)-timedelta(seconds=10)), 409),
])
def test_student_submit_blocks_wrong_state(ctx, task, code):
    with pytest.raises(HTTPException) as error:
        tasks._can_submit(ctx, task)
    assert error.value.status_code == code


def test_editor_policy_excludes_student():
    with pytest.raises(HTTPException) as error:
        tasks._editor(scope())
    assert error.value.status_code == 403
    tasks._editor(scope(editor=True, enrolled=False))


def test_student_policy_excludes_unenrolled():
    with pytest.raises(HTTPException) as error:
        tasks._student(scope(editor=True, enrolled=False))
    assert error.value.status_code == 403


class Result:
    def __init__(self, value=None, items=None):
        self.value = value
        self.items = items

    def mappings(self):
        return self

    def first(self):
        return self.value

    def one(self):
        return self.value

    def scalar_one(self):
        return self.value

    def all(self):
        return self.items or []


class Conn:
    def __init__(self, *, count=0, inserted=True):
        self.statements = []
        self.count = count
        self.inserted = inserted

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.statements.append((sql, params or {}))
        if "SELECT id FROM app.enrollments" in sql:
            return Result({"id": ENROLLMENT})
        if "SELECT count(*) FROM app.task_submissions" in sql:
            return Result(self.count)
        if "SELECT count(*) FROM app.task_submission_files" in sql:
            return Result(0)
        if "INSERT INTO app.task_submissions" in sql:
            return Result({"id": SUBMISSION, "attempt_number": self.count+1,
                           "submitted_at": datetime.now(UTC),
                           "status": "submitted"} if self.inserted else None)
        if "UPDATE app.task_submissions" in sql:
            return Result({"id": SUBMISSION})
        return Result()


class Engine:
    def __init__(self, conn):
        self.conn = conn

    def begin(self):
        return self

    def connect(self):
        return self

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *_args):
        return None


@pytest.fixture
def permissions(monkeypatch):
    async def context(*_args):
        return scope()

    async def find_task(*_args, **_kwargs):
        return assignment()

    async def audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(tasks, "_context", context)
    monkeypatch.setattr(tasks, "_task", find_task)
    monkeypatch.setattr(tasks, "_audit", audit)


# Ejecutamos endpoints async con asyncio.run para no exigir pytest-asyncio.
def test_submission_serializes_attempts_and_binds_offering(permissions):
    connection = Conn(count=1)
    result = asyncio.run(tasks.submit_task(
        ORG, OFFER, TASK, tasks.AnswerInput(answer_text="Respuesta completa"),
        ACTOR, Engine(connection)))
    assert result["attempt_number"] == 2
    lock = next((sql, values) for sql, values in connection.statements if "FROM app.enrollments" in sql)
    assert "FOR UPDATE" in lock[0]
    assert lock[1]["offering_id"] == OFFER
    insert = next((sql, values) for sql, values in connection.statements if "INSERT INTO app.task_submissions" in sql)
    assert "clock_timestamp()<=t.due_at" in insert[0]
    assert insert[1]["org"] == ORG
    assert insert[1]["offering_id"] == OFFER
    assert insert[1]["enrollment_id"] == ENROLLMENT


def test_submission_rejects_attempt_limit(permissions):
    with pytest.raises(HTTPException) as error:
        asyncio.run(tasks.submit_task(ORG, OFFER, TASK,
                                      tasks.AnswerInput(answer_text="Otra entrega"),
                                      ACTOR, Engine(Conn(count=2))))
    assert error.value.status_code == 409


def test_submission_rejects_db_deadline_race(permissions):
    with pytest.raises(HTTPException) as error:
        asyncio.run(tasks.submit_task(ORG, OFFER, TASK,
                                      tasks.AnswerInput(answer_text="Entrega a tiempo"),
                                      ACTOR, Engine(Conn(inserted=False))))
    assert error.value.status_code == 409


def test_review_requires_editor(monkeypatch, permissions):
    async def student(*_args):
        return scope()

    monkeypatch.setattr(tasks, "_context", student)
    with pytest.raises(HTTPException) as error:
        asyncio.run(tasks.review_submission(ORG, OFFER, TASK, SUBMISSION,
                                           tasks.ReviewInput(review_notes="Buen desarrollo."),
                                           ACTOR, Engine(Conn())))
    assert error.value.status_code == 403


def test_review_changes_only_submitted_in_same_offering(monkeypatch, permissions):
    async def editor(*_args):
        return scope(editor=True)

    monkeypatch.setattr(tasks, "_context", editor)
    conn = Conn()
    asyncio.run(tasks.review_submission(ORG, OFFER, TASK, SUBMISSION,
                                        tasks.ReviewInput(review_notes="Buen desarrollo."),
                                        ACTOR, Engine(conn)))
    update = next((sql, params) for sql, params in conn.statements if "UPDATE app.task_submissions" in sql)
    assert "status='submitted'" in update[0]
    assert "offering_id=:offering_id" in update[0]
    assert update[1]["submission_id"] == SUBMISSION


def test_routes_are_registered_and_protected():
    client = TestClient(app)
    # Sin credenciales no se permite ni enumerar tareas ni enviar entregas.
    response = client.get(f"/api/v1/academic/organizations/{ORG}/course-offerings/{OFFER}/tasks")
    assert response.status_code == 401
    response = client.post(f"/api/v1/academic/organizations/{ORG}/course-offerings/{OFFER}/tasks/{TASK}/submissions",
                           json={"answer_text": "intento de envío"})
    assert response.status_code == 401


def test_migration_scopes_both_foreign_keys_and_rls():
    project = Path(__file__).resolve().parents[3]
    migration = (project / "database/migrations/011_course_tasks.sql").read_text(encoding="utf8")
    assert "(organization_id,task_id,offering_id)" in migration
    assert "(organization_id,enrollment_id,offering_id)" in migration
    assert "FORCE ROW LEVEL SECURITY" in migration
    assert "REVOKE ALL" in migration
