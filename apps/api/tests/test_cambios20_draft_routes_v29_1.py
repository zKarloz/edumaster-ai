"""Contratos de borradores v29.1 con conexión simulada; no sustituyen SQL real.

Las rutas están registradas; aquí se comprueban las funciones del servicio.
La autenticación HTTP se comprueba en test_cambios20_router_auth_v29_1.
"""

import asyncio
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.routers import lesson_revisions as drafts
from app.services.lesson_documents import DraftSave

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
LESSON = UUID("33333333-3333-4333-8333-333333333333")
REV = UUID("44444444-4444-4444-8444-444444444444")
PUB = UUID("55555555-5555-4555-8555-555555555555")


class Result:
    def __init__(self, row=None):
        self.row = row

    def mappings(self):
        return self

    def first(self):
        return self.row

    def one(self):
        assert self.row is not None
        return self.row


class Conn:
    def __init__(self, *, has_draft=True, status="published", version=1):
        self.has_draft = has_draft
        self.status = status
        self.version = version
        self.queries = []
        self.audit_log = []
        self.draft = {
            "id": REV, "title": "Título original", "document_format": "plain-text-v1",
            "document_body": "Primera línea\nSegunda línea", "lock_version": version,
            "base_revision_id": PUB, "updated_at": "2026-11-23T20:00:00Z",
        }

    async def execute(self, statement, params=None):
        sql = str(statement)
        params = params or {}
        self.queries.append(sql)
        if "SELECT status FROM app.lessons" in sql or "SELECT status FROM app.offering_lessons" in sql:
            return Result({"status": self.status})
        if "FROM app.lesson_revisions" in sql and "revision_state='draft'" in sql:
            return Result(dict(self.draft) if self.has_draft else None)
        if "FROM app.lesson_revisions" in sql and "revision_state='published'" in sql:
            return Result({
                "id": PUB, "title": "Versión publicada", "document_format": "plain-text-v1",
                "document_body": "Visible para estudiantes",
            })
        if "INSERT INTO app.lesson_revisions" in sql:
            self.has_draft = True
            self.draft = {
                "id": REV, "title": params["title"], "document_format": "tiptap-json-v1",
                "document_body": params["body"], "lock_version": 1,
                "base_revision_id": PUB, "updated_at": "2026-11-23T20:00:01Z",
            }
            return Result(dict(self.draft))
        if "UPDATE app.lesson_revisions" in sql:
            self.version += 1
            self.draft.update({"title": params["title"], "document_body": params["body"],
                               "document_format": "tiptap-json-v1", "lock_version": self.version})
            return Result(dict(self.draft))
        raise AssertionError(f"SQL no esperado: {sql[:100]}")


@pytest.fixture(autouse=True)
def fake_permissions(monkeypatch):
    async def authorized(*args, **kwargs):
        return ACTOR

    async def audit(conn, org, actor, action, resource, record_id):
        conn.audit_log.append((action, resource, record_id))

    monkeypatch.setattr(drafts, "_authorize", authorized)
    monkeypatch.setattr(drafts, "_audit", audit)


@pytest.mark.parametrize("source", ["institutional", "offering"])
def test_read_legacy_draft_without_writing(source):
    conn = Conn()
    response = asyncio.run(drafts._get(conn, ACTOR, ORG, LESSON, source))
    assert response["source"] == source
    assert response["document"]["content"][1]["content"][0]["text"] == "Segunda línea"
    assert not any("INSERT INTO" in sql or "UPDATE " in sql for sql in conn.queries)


def test_get_without_draft_returns_404():
    with pytest.raises(HTTPException) as error:
        asyncio.run(drafts._get(Conn(has_draft=False), ACTOR, ORG, LESSON, "institutional"))
    assert error.value.status_code == 404


def test_create_from_published_does_not_change_public_projection():
    conn = Conn(has_draft=False)
    response = asyncio.run(drafts._create(conn, ACTOR, ORG, LESSON, "offering"))
    assert response["base_revision_id"] == str(PUB)
    assert response["document"]["content"][0]["content"][0]["text"] == "Visible para estudiantes"
    assert any("INSERT INTO app.lesson_revisions" in sql for sql in conn.queries)
    assert not any("UPDATE app.offering_lessons" in sql for sql in conn.queries)
    assert conn.audit_log[0][0] == "create_draft"


def test_duplicate_draft_returns_409():
    with pytest.raises(HTTPException) as error:
        asyncio.run(drafts._create(Conn(), ACTOR, ORG, LESSON, "institutional"))
    assert error.value.status_code == 409


def test_archived_lesson_cannot_create_draft():
    with pytest.raises(HTTPException) as error:
        asyncio.run(drafts._create(Conn(has_draft=False, status="archived"), ACTOR,
                                    ORG, LESSON, "offering"))
    assert error.value.status_code == 409


def test_save_increments_lock_version_without_changing_published():
    conn = Conn(version=3)
    payload = DraftSave(
        title="Título cambiado", expected_lock_version=3,
        document={"type": "doc", "content": [{"type": "paragraph", "content": [
            {"type": "text", "text": "Borrador privado"}]}]},
    )
    response = asyncio.run(drafts._save(conn, ACTOR, ORG, LESSON, "institutional", payload))
    assert response["lock_version"] == 4
    assert response["document"]["content"][0]["content"][0]["text"] == "Borrador privado"
    assert not any("UPDATE app.lessons" in sql for sql in conn.queries)
    assert conn.audit_log[0][0] == "save_draft"


def test_concurrent_save_returns_409_without_changes():
    conn = Conn(version=4)
    payload = DraftSave(title="Cambio", document={"type": "doc"}, expected_lock_version=3)
    with pytest.raises(HTTPException) as error:
        asyncio.run(drafts._save(conn, ACTOR, ORG, LESSON, "institutional", payload))
    assert error.value.status_code == 409
    assert not any("UPDATE app.lesson_revisions" in sql for sql in conn.queries)
