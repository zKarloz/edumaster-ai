"""CAMBIOS 21 v30.2.2: revisión individual por oferta e identidad.

Simulamos el origen SQL para verificar permisos antes de consultar datos de
un estudiante. No necesitamos sesiones reales ni abrir conexiones a Supabase.
"""

import asyncio
from contextlib import asynccontextmanager
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.routers import course_tasks as tasks

ORG = UUID("11111111-1111-4111-8111-111111111111")
OFFER = UUID("33333333-3333-4333-8333-333333333333")
TASK = UUID("44444444-4444-4444-8444-444444444444")
SUBMISSION = UUID("66666666-6666-4666-8666-666666666666")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")


class Result:
    def __init__(self, item):
        self.item = item

    def mappings(self):
        return self

    def first(self):
        return self.item


class Connection:
    def __init__(self, record):
        self.record = record
        self.queries = []

    async def execute(self, statement, params):
        sql = str(statement)
        self.queries.append((sql, params))
        return Result(self.record)


class Engine:
    def __init__(self, record):
        self.conn = Connection(record)

    @asynccontextmanager
    async def connect(self):
        yield self.conn


def test_review_page_rejects_students_before_query(monkeypatch):
    async def context(*_args):
        return {"editor": False, "actor": ACTOR}

    async def task(*_args):
        return {"id": TASK, "title": "Tarea"}

    monkeypatch.setattr(tasks, "_context", context)
    monkeypatch.setattr(tasks, "_task", task)
    engine = Engine(None)
    with pytest.raises(HTTPException) as error:
        asyncio.run(tasks.get_submission_for_review(ORG, OFFER, TASK, SUBMISSION, ACTOR, engine))
    assert error.value.status_code == 403
    assert engine.conn.queries == []


def test_review_page_restricts_query_to_all_ids(monkeypatch):
    async def context(*_args):
        return {"editor": True, "actor": ACTOR}

    async def task(*_args):
        return {"id": TASK, "title": "Tarea", "status": "published"}

    monkeypatch.setattr(tasks, "_context", context)
    monkeypatch.setattr(tasks, "_task", task)
    engine = Engine({"id": SUBMISSION, "answer_text": "Respuesta", "status": "submitted"})
    result = asyncio.run(tasks.get_submission_for_review(ORG, OFFER, TASK, SUBMISSION, ACTOR, engine))
    assert result["submission"]["id"] == str(SUBMISSION)
    assert result["task"]["id"] == str(TASK)
    sql, params = engine.conn.queries[0]
    assert "s.organization_id=:org" in sql
    assert "s.offering_id=:offering_id" in sql
    assert "s.task_id=:task_id" in sql
    assert "s.id=:submission_id" in sql
    assert params == {"org": ORG, "offering_id": OFFER, "task_id": TASK,
                      "submission_id": SUBMISSION}


def test_review_page_returns_404_for_other_submission(monkeypatch):
    async def context(*_args):
        return {"editor": True, "actor": ACTOR}

    async def task(*_args):
        return {"id": TASK, "title": "Tarea"}

    monkeypatch.setattr(tasks, "_context", context)
    monkeypatch.setattr(tasks, "_task", task)
    with pytest.raises(HTTPException) as error:
        asyncio.run(tasks.get_submission_for_review(
            ORG, OFFER, TASK, SUBMISSION, ACTOR, Engine(None),
        ))
    assert error.value.status_code == 404
