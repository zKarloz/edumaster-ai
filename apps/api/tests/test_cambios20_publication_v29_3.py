"""Regresiones de publicación/restauración v29.3 con transacciones simuladas.

Las pruebas SQL reales requieren PostgreSQL y los datos ficticios del manual;
este conjunto verifica los contratos y el orden atómico de las operaciones.
"""

import asyncio
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.routers import lesson_publication as publication
from app.routers import lesson_published as reader
from app.services.lesson_publication import document_to_plain_text

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
LESSON = UUID("33333333-3333-4333-8333-333333333333")
DRAFT = UUID("44444444-4444-4444-8444-444444444444")
PUBLISHED = UUID("55555555-5555-4555-8555-555555555555")
HISTORY = UUID("66666666-6666-4666-8666-666666666666")
DOC = {"type": "doc", "content": [{"type": "heading", "attrs": {"level": 2},
                                      "content": [{"type": "text", "text": "Lección"}]},
                                     {"type": "paragraph", "content": [{"type": "text", "text": "Texto publicado"}]}]}


class Result:
    def __init__(self, value=None):
        self.value = value

    def mappings(self):
        return self

    def first(self):
        return self.value

    def one(self):
        return self.value

    def scalar_one(self):
        return self.value


class Connection:
    def __init__(self, *, count=3, current=True):
        self.queries = []
        self.count = count
        self.current = current

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.queries.append((sql, params or {}))
        if "SELECT count(*) FROM app.course_offerings" in sql:
            return Result(self.count)
        if "SELECT COALESCE(MAX(revision_number)" in sql:
            return Result(3)
        if "revision_state='published'" in sql and "SELECT" in sql:
            if not self.current:
                return Result(None)
            return Result({"id": PUBLISHED, "title": "Anterior", "revision_number": 2,
                           "document_format": "plain-text-v1", "document_body": "Anterior"})
        if "FROM app.lesson_revisions" in sql and "revision_state <> 'draft'" in sql:
            return Result({"id": HISTORY, "title": "Historia", "document_format": "tiptap-json-v1", "document_body": ""})
        if "INSERT INTO app.lesson_revisions" in sql:
            return Result({"id": DRAFT})
        return Result()


@pytest.fixture
def authorization(monkeypatch):
    async def allowed(*_args, **_kwargs):
        return ACTOR

    async def active(*_args, **_kwargs):
        return "published"

    async def draft(*_args, **_kwargs):
        return {"id": DRAFT, "title": "Lección publicada", "lock_version": 2,
                "document_format": "tiptap-json-v1", "document_body": "", "base_revision_id": PUBLISHED}

    async def audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(publication, "_authorize", allowed)
    monkeypatch.setattr(publication, "_lesson_status", active)
    monkeypatch.setattr(publication, "_draft", draft)
    monkeypatch.setattr(publication, "_audit", audit)
    monkeypatch.setattr(publication, "_document", lambda *_: DOC)
    return draft


def test_plain_text_projection_contains_no_html():
    plain = document_to_plain_text(DOC)
    assert plain == "Lección\nTexto publicado"
    assert "<" not in plain


def test_publish_request_rejects_unbounded_values():
    with pytest.raises(ValidationError):
        publication.PublishRequest(expected_lock_version=0)
    with pytest.raises(ValidationError):
        publication.PublishRequest(expected_lock_version=1, expected_affected_offerings=-1)


def test_concurrent_publish_stops_before_any_write(authorization):
    conn = Connection()
    with pytest.raises(HTTPException) as error:
        asyncio.run(publication._publish(conn, ACTOR, ORG, LESSON, "offering",
                                         publication.PublishRequest(expected_lock_version=1)))
    assert error.value.status_code == 409
    assert not conn.queries


def test_institutional_publish_needs_confirmed_impact(authorization):
    conn = Connection(count=5)
    with pytest.raises(HTTPException) as error:
        asyncio.run(publication._publish(conn, ACTOR, ORG, LESSON, "institutional",
                                         publication.PublishRequest(expected_lock_version=2,
                                                                    expected_affected_offerings=4)))
    assert error.value.status_code == 409
    assert all("UPDATE " not in sql for sql, _ in conn.queries)


@pytest.mark.parametrize("source", ["institutional", "offering"])
def test_publishing_replaces_current_then_updates_public_projection(authorization, source):
    conn = Connection()
    payload = publication.PublishRequest(expected_lock_version=2, expected_affected_offerings=3)
    result = asyncio.run(publication._publish(conn, ACTOR, ORG, LESSON, source, payload))
    assert result["revision_number"] == 3
    sqls = [sql for sql, _ in conn.queries]
    superseded = next(i for i, sql in enumerate(sqls) if "revision_state='superseded'" in sql)
    published = next(i for i, sql in enumerate(sqls) if "SET revision_state='published'" in sql or "revision_state='published', revision_number=" in sql)
    visible = next(i for i, sql in enumerate(sqls) if "UPDATE app.lessons" in sql or "UPDATE app.offering_lessons" in sql)
    assert superseded < published < visible
    assert "UPDATE app.lesson_revisions" in sqls[published]
    assert any(params.get("content") == "Lección\nTexto publicado" for _, params in conn.queries)


def test_first_publication_skips_superseding(authorization):
    conn = Connection(current=False)
    result = asyncio.run(publication._publish(conn, ACTOR, ORG, LESSON, "offering",
                publication.PublishRequest(expected_lock_version=2)))
    assert result["revision_number"] == 3
    assert not any("revision_state='superseded'" in sql for sql, _ in conn.queries)


def test_restore_must_confirm_draft_replacement(authorization):
    conn = Connection()
    with pytest.raises(HTTPException) as error:
        asyncio.run(publication._restore(conn, ACTOR, ORG, LESSON, "offering", HISTORY,
                                         publication.RestoreRequest(expected_published_revision_id=PUBLISHED)))
    assert error.value.status_code == 409
    assert not any("DELETE FROM" in sql for sql, _ in conn.queries)


def test_restore_copies_resources_and_never_modifies_published(authorization):
    conn = Connection()
    result = asyncio.run(publication._restore(conn, ACTOR, ORG, LESSON, "offering", HISTORY,
        publication.RestoreRequest(expected_published_revision_id=PUBLISHED,
                                   replace_draft_id=DRAFT, expected_draft_lock_version=2)))
    assert result["draft_id"] == str(DRAFT)
    sqls = [sql for sql, _ in conn.queries]
    assert any("DELETE FROM app.lesson_revision_resources" in sql for sql in sqls)
    assert any("INSERT INTO app.lesson_revision_resources" in sql for sql in sqls)
    assert not any("UPDATE app.offering_lessons" in sql for sql in sqls)


def test_reader_rejects_user_without_assignment_or_enrollment(monkeypatch):
    async def scope(*_args):
        return {"actor_id": ACTOR, "is_manager": False}

    class AccessConn:
        async def execute(self, statement, params=None):
            return Result({"assigned": False, "enrolled": False,
                           "course_status": "published", "course_id": LESSON})

    monkeypatch.setattr(reader, "_actor_scope", scope)
    with pytest.raises(HTTPException) as error:
        asyncio.run(reader._allowed_revision(AccessConn(), ACTOR, ORG, LESSON, LESSON, "base"))
    assert error.value.status_code == 403


def test_reader_checks_course_publication_for_students(monkeypatch):
    async def scope(*_args):
        return {"actor_id": ACTOR, "is_manager": False}

    class AccessConn:
        async def execute(self, statement, params=None):
            return Result({"assigned": False, "enrolled": True,
                           "course_status": "draft", "course_id": LESSON})

    monkeypatch.setattr(reader, "_actor_scope", scope)
    with pytest.raises(HTTPException) as error:
        asyncio.run(reader._allowed_revision(AccessConn(), ACTOR, ORG, LESSON, LESSON, "offering"))
    assert error.value.status_code == 404


@pytest.mark.parametrize("method,suffix", [
    ("POST", "/lessons/" + str(LESSON) + "/publish"),
    ("GET", "/lessons/" + str(LESSON) + "/history"),
    ("POST", "/lessons/" + str(LESSON) + "/revisions/" + str(HISTORY) + "/restore"),
    ("GET", "/course-offerings/" + str(LESSON) + "/published-lessons/base/" + str(LESSON)),
    ("GET", "/courses/" + str(LESSON) + "/published-lessons/" + str(LESSON)),
    ("GET", "/course-offerings/" + str(LESSON) + "/published-lessons/base/" + str(LESSON)
     + "/resources/" + str(HISTORY) + "/download"),
])
def test_publication_routes_require_jwt(method, suffix):
    client = TestClient(app)
    response = client.request(method, f"/api/v1/academic/organizations/{ORG}{suffix}")
    assert response.status_code == 401
