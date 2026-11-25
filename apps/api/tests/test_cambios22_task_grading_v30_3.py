"""Contratos v30.3: puntajes, autorización, cierre, auditoría y migración."""

import asyncio
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routers import task_grading as grade

ORG = UUID("11111111-1111-4111-8111-111111111111")
OFFER = UUID("33333333-3333-4333-8333-333333333333")
TASK = UUID("44444444-4444-4444-8444-444444444444")
SUBMISSION = UUID("66666666-6666-4666-8666-666666666666")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
CRITERION_A = UUID("77777777-7777-4777-8777-777777777777")
CRITERION_B = UUID("88888888-8888-4888-8888-888888888888")


def rubric():
    return [{"id": CRITERION_A, "title": "Investigación", "max_points": Decimal("12.50")},
            {"id": CRITERION_B, "title": "Redacción", "max_points": Decimal("7.50")}]


def test_rubric_input_accepts_weighted_criteria():
    payload = grade.RubricInput(items=[
        {"title": "Investigación", "max_points": "12.50"},
        {"title": "Redacción", "max_points": "7.50"},
    ])
    assert sum(item.max_points for item in payload.items) == Decimal("20.00")


@pytest.mark.parametrize("criteria", [
    [], [{"title": "a", "max_points": "5"}],
    [{"title": "Investigación", "max_points": "0"}],
    [{"title": "Igual", "max_points": "5"}, {"title": "igual", "max_points": "5"}],
    [{"title": "Primero", "max_points": "60"}, {"title": "Segundo", "max_points": "60"}],
    [{"title": "Investigación", "max_points": "1.123"}],
])
def test_invalid_rubrics_rejected(criteria):
    with pytest.raises(ValidationError):
        grade.RubricInput(items=criteria)


def test_scoring_exact_criteria_and_sum():
    payload = grade.OfficialGradeIn(criteria=[
        {"criterion_id": CRITERION_A, "points": "11.25", "comment": "Bien"},
        {"criterion_id": CRITERION_B, "points": "6.50"},
    ])
    score, maximum, breakdown = grade._score_rubric(rubric(), payload.criteria)
    assert (score, maximum) == (Decimal("17.75"), Decimal("20.00"))
    assert breakdown[0]["criterion_id"] == str(CRITERION_A)
    assert breakdown[1]["max_points"] == "7.50"


@pytest.mark.parametrize("criteria", [
    [{"criterion_id": CRITERION_A, "points": "1"}],
    [{"criterion_id": CRITERION_A, "points": "13"},
     {"criterion_id": CRITERION_B, "points": "1"}],
    [{"criterion_id": CRITERION_A, "points": "1"},
     {"criterion_id": "99999999-9999-4999-8999-999999999999", "points": "1"}],
])
def test_scoring_rejects_missing_excessive_and_foreign_criteria(criteria):
    payload = grade.OfficialGradeIn(criteria=criteria)
    with pytest.raises(HTTPException) as error:
        grade._score_rubric(rubric(), payload.criteria)
    assert error.value.status_code == 422


def test_duplicate_criterion_id_rejected():
    with pytest.raises(ValidationError):
        grade.OfficialGradeIn(criteria=[
            {"criterion_id": CRITERION_A, "points": 1},
            {"criterion_id": CRITERION_A, "points": 2},
        ])


def test_grade_rejects_negative_and_unbounded_points():
    for value in ["-1", "1.234", "1000000"]:
        with pytest.raises(ValidationError):
            grade.OfficialGradeIn(criteria=[{"criterion_id": CRITERION_A, "points": value}])


class Conn:
    def __init__(self):
        self.executed = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def execute(self, statement, parameters=None):
        self.executed.append((str(statement), parameters))
        raise AssertionError("No se permite SQL antes de validar los permisos")


class Engine:
    def __init__(self):
        self.conn = Conn()

    def begin(self):
        return self.conn

    def connect(self):
        return self.conn


async def _deny_context(*_):
    raise HTTPException(status_code=403, detail="Sin permiso")


async def _editor_context(*_):
    return {"editor": True, "actor": ACTOR}


async def _open_task(*_, **__):
    return {"status": "published"}


def test_unauthorized_cannot_read_grades_or_modify_rubric(monkeypatch):
    monkeypatch.setattr(grade, "_context", _deny_context)
    engine = Engine()
    with pytest.raises(HTTPException) as error:
        asyncio.run(grade.get_submission_grade(ORG, OFFER, TASK, SUBMISSION, ACTOR, engine))
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        asyncio.run(grade.save_rubric(ORG, OFFER, TASK,
            grade.RubricInput(items=[{"title": "Objetivo", "max_points": 20}]), ACTOR, engine))
    assert error.value.status_code == 403
    assert not engine.conn.executed


def test_published_task_cannot_receive_official_grade(monkeypatch):
    monkeypatch.setattr(grade, "_context", _editor_context)
    monkeypatch.setattr(grade, "_task", _open_task)
    engine = Engine()
    payload = grade.OfficialGradeIn(criteria=[{"criterion_id": CRITERION_A, "points": 2}])
    with pytest.raises(HTTPException) as error:
        asyncio.run(grade.put_submission_grade(ORG, OFFER, TASK, SUBMISSION, payload, ACTOR, engine))
    assert error.value.status_code == 409
    assert not engine.conn.executed


def test_migration_ensures_single_official_grade_and_scope():
    sql = (Path(__file__).resolve().parents[3] / "database" / "migrations" /
           "013_task_rubrics_and_official_grades.sql").read_text(encoding="utf-8")
    assert "UNIQUE (organization_id,task_id,enrollment_id)" in sql
    assert "REFERENCES app.task_submissions(organization_id,id,task_id,enrollment_id,offering_id)" in sql
    assert "REFERENCES app.academic_activity_records(organization_id,id,enrollment_id)" in sql
    assert sql.count("FORCE ROW LEVEL SECURITY") == 3
    assert "previous_criteria_scores JSONB" in sql


def test_official_grades_not_voidable_from_generic_activity_module():
    source = (Path(__file__).resolve().parents[1] / "app" / "routers" /
              "academic_activity.py").read_text(encoding="utf-8")
    assert "Rectifica esta nota desde la tarea evaluada" in source


class GradeResult:
    def __init__(self, value=None):
        self.value = value

    def mappings(self):
        return self

    def first(self):
        return self.value

    def scalar_one(self):
        return self.value


class GradeConn(Conn):
    async def execute(self, statement, parameters=None):
        sql = str(statement)
        self.executed.append((sql, parameters or {}))
        if "FROM app.task_submissions" in sql and "FOR UPDATE" in sql:
            return GradeResult({"id": SUBMISSION, "status": "reviewed", "attempt_number": 1,
                                "enrollment_id": UUID("55555555-5555-4555-8555-555555555555")})
        if "SELECT 1 FROM app.task_submissions" in sql:
            return GradeResult()
        if "INSERT INTO app.academic_activity_records" in sql:
            return GradeResult(UUID("99999999-9999-4999-8999-999999999999"))
        if "UPDATE app.academic_activity_records" in sql:
            return GradeResult({"id": UUID("99999999-9999-4999-8999-999999999999")})
        return GradeResult()


class GradeEngine(Engine):
    def __init__(self):
        self.conn = GradeConn()


async def _closed_task(*_, **__):
    return {"status": "closed", "title": "Tarea evaluada"}


async def _criteria_stub(*_):
    return rubric()


async def _audit_stub(*_):
    return None


def test_first_grade_generates_single_academic_record(monkeypatch):
    async def no_grade(*_, **__):
        return None

    monkeypatch.setattr(grade, "_context", _editor_context)
    monkeypatch.setattr(grade, "_task", _closed_task)
    monkeypatch.setattr(grade, "_criteria", _criteria_stub)
    monkeypatch.setattr(grade, "_grade", no_grade)
    monkeypatch.setattr(grade, "_audit", _audit_stub)
    engine = GradeEngine()
    payload = grade.OfficialGradeIn(criteria=[
        {"criterion_id": CRITERION_A, "points": "10"},
        {"criterion_id": CRITERION_B, "points": "7"},
    ])
    result = asyncio.run(grade.put_submission_grade(ORG, OFFER, TASK, SUBMISSION, payload, ACTOR, engine))
    sql = [statement for statement, _ in engine.conn.executed]
    assert result["revision"] == 1
    assert result["score"] == Decimal(17)
    assert sum("INSERT INTO app.academic_activity_records" in item for item in sql) == 1
    assert sum("INSERT INTO app.task_official_grades" in item for item in sql) == 1
    assert not any("INSERT INTO app.task_official_grade_history" in item for item in sql)


def test_grade_correction_updates_existing_academic_record_and_creates_history(monkeypatch):
    academic = UUID("99999999-9999-4999-8999-999999999999")

    async def prior_grade(*_, **__):
        return {"id": UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), "revision": 1,
                "submission_id": SUBMISSION, "academic_record_id": academic,
                "score": Decimal(16), "max_score": Decimal(20),
                "criteria_scores": [], "feedback": "Comentario anterior"}

    monkeypatch.setattr(grade, "_context", _editor_context)
    monkeypatch.setattr(grade, "_task", _closed_task)
    monkeypatch.setattr(grade, "_criteria", _criteria_stub)
    monkeypatch.setattr(grade, "_grade", prior_grade)
    monkeypatch.setattr(grade, "_audit", _audit_stub)
    engine = GradeEngine()
    payload = grade.OfficialGradeIn(expected_revision=1, criteria=[
        {"criterion_id": CRITERION_A, "points": "11"},
        {"criterion_id": CRITERION_B, "points": "7"},
    ])
    result = asyncio.run(grade.put_submission_grade(ORG, OFFER, TASK, SUBMISSION, payload, ACTOR, engine))
    sql = [statement for statement, _ in engine.conn.executed]
    assert result["revision"] == 2
    assert sum("INSERT INTO app.task_official_grade_history" in item for item in sql) == 1
    assert sum("UPDATE app.academic_activity_records" in item for item in sql) == 1
    assert not any("INSERT INTO app.academic_activity_records" in item for item in sql)
