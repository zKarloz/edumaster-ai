"""Regresión v29.1: compatibilidad de endpoints heredados con revisiones.

El simulador no sustituye las pruebas SQL en Supabase. Comprueba invariantes
sobre el orden y los parámetros de las escrituras transaccionales.
"""

import asyncio
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app
from app.services.lesson_revision_compat import create_initial_draft, sync_legacy_update

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

    def scalar_one(self):
        return self.row


class Conn:
    """Retiene las operaciones de revisión como si ocurrieran en una transacción."""

    def __init__(self, *, draft=True, published=False, fmt="plain-text-v1"):
        self.draft = ({
            "id": REV, "title": "Título inicial", "document_body": "Contenido previo",
            "document_format": fmt, "lock_version": 1, "revision_number": None,
            "base_revision_id": None, "legacy_content_was_null": False,
        } if draft else None)
        self.published = ({**(self.draft or {}), "id": PUB,
                           "revision_number": 1, "document_format": "plain-text-v1"}
                          if published else None)
        self.queries = []

    async def execute(self, statement, params=None):
        sql = str(statement)
        params = params or {}
        self.queries.append((sql, params))
        if "FROM app.lesson_revisions" in sql and "revision_state=:state" in sql:
            return Result(self.draft if params["state"] == "draft" else self.published)
        if "SELECT COALESCE(MAX(revision_number)" in sql:
            return Result(2 if self.published else 1)
        if "INSERT INTO app.lesson_revisions" in sql:
            self.draft = {
                "id": REV, "title": params["title"], "document_body": params["body"],
                "document_format": "plain-text-v1", "lock_version": 1,
                "revision_number": None, "base_revision_id": params.get("base_id"),
                "legacy_content_was_null": params["was_null"],
            }
            return Result()
        if "UPDATE app.lesson_revisions" in sql:
            assert self.draft is not None
            if "SET revision_state='published'" in sql:
                self.draft["revision_number"] = params["number"]
                self.draft["lock_version"] += 1
                self.published, self.draft = self.draft, None
            else:
                self.draft.update({
                    "title": params["title"], "document_body": params["body"],
                    "legacy_content_was_null": params["was_null"],
                })
                self.draft["lock_version"] += params["increment"]
            return Result()
        raise AssertionError(f"Consulta no prevista: {sql[:95]}")


def run_change(conn, *, source="institutional", current="draft", changes=None,
               title="Título inicial", content="Contenido previo"):
    return asyncio.run(sync_legacy_update(
        conn, ORG, LESSON, ACTOR, source, current, title, content, changes or {},
    ))


@pytest.mark.parametrize("source", ["institutional", "offering"])
@pytest.mark.parametrize("body", [None, "", "Texto plano"])
def test_initial_legacy_draft_is_transactionally_staged(source, body):
    conn = Conn(draft=False)
    asyncio.run(create_initial_draft(conn, ORG, LESSON, ACTOR, source, "Lección de prueba", body))
    assert conn.draft["title"] == "Lección de prueba"
    assert conn.draft["document_body"] == (body or "")
    assert conn.draft["legacy_content_was_null"] is (body is None)
    assert all(params["org"] == ORG for _, params in conn.queries)
    column = "institutional_lesson_id" if source == "institutional" else "offering_lesson_id"
    assert column in conn.queries[0][0]


@pytest.mark.parametrize("source", ["institutional", "offering"])
def test_plain_draft_edit_synchronizes_revision_only(source):
    conn = Conn()
    run_change(conn, source=source, changes={"title": "Título editado", "content": "Texto editado"})
    assert conn.draft["title"] == "Título editado"
    assert conn.draft["document_body"] == "Texto editado"
    assert conn.draft["lock_version"] == 2
    assert not any("UPDATE app.lessons" in sql or "UPDATE app.offering_lessons" in sql
                   for sql, _ in conn.queries)


@pytest.mark.parametrize("source", ["institutional", "offering"])
def test_legacy_draft_publication_creates_numbered_revision(source):
    conn = Conn()
    run_change(conn, source=source, changes={"status": "published", "title": "Título publicado"})
    assert conn.published["revision_number"] == 1
    assert conn.published["title"] == "Título publicado"
    assert conn.published["lock_version"] == 2  # Una edición+publicación = un incremento.
    assert conn.draft is None


@pytest.mark.parametrize("change", [
    {"status": "draft"}, {"title": "Alteración"}, {"content": "Texto cambiado"},
    {"status": "draft", "content": "Pérdida de versión"},
])
def test_published_lesson_cannot_be_unpublished_or_overwritten(change):
    conn = Conn(draft=False, published=True)
    with pytest.raises(HTTPException) as error:
        run_change(conn, current="published", changes=change)
    assert error.value.status_code == 409
    assert not any("UPDATE app.lesson_revisions" in sql for sql, _ in conn.queries)


def test_published_lesson_can_be_archived_without_destroying_revision():
    conn = Conn(draft=False, published=True)
    run_change(conn, current="published", changes={"status": "archived"})
    assert conn.published is not None
    assert conn.draft is None
    assert not conn.queries


def test_tiptap_draft_is_not_mutable_from_legacy_patch():
    conn = Conn(fmt="tiptap-json-v1")
    with pytest.raises(HTTPException) as error:
        run_change(conn, changes={"content": "No puede sobrescribir Tiptap"})
    assert error.value.status_code == 409
    assert not any("UPDATE app.lesson_revisions" in sql for sql, _ in conn.queries)


def test_tiptap_draft_cannot_publish_before_versioned_publication_exists():
    conn = Conn(fmt="tiptap-json-v1")
    with pytest.raises(HTTPException) as error:
        run_change(conn, changes={"status": "published"})
    assert error.value.status_code == 409


def test_archived_legacy_lesson_can_reopen_as_draft_without_rewriting_old_history():
    conn = Conn(draft=False)
    run_change(conn, current="archived", changes={"status": "draft"})
    assert conn.draft["document_format"] == "plain-text-v1"
    assert conn.draft["base_revision_id"] is None


def test_archived_publication_can_be_restored_without_new_revision():
    conn = Conn(draft=False, published=True)
    run_change(conn, current="archived", changes={"status": "published"})
    assert conn.published and conn.published["revision_number"] == 1
    assert conn.draft is None


def test_archive_cannot_publish_snapshot_without_approved_draft():
    conn = Conn(draft=False)
    with pytest.raises(HTTPException) as error:
        run_change(conn, current="archived", changes={"status": "published"})
    assert error.value.status_code == 409


def test_archived_lesson_cannot_edit_title_without_reactivation():
    with pytest.raises(HTTPException) as error:
        run_change(Conn(draft=False), current="archived", changes={"title": "No disponible"})
    assert error.value.status_code == 409


def test_inconsistent_missing_draft_fails_closed():
    with pytest.raises(HTTPException) as error:
        run_change(Conn(draft=False), changes={"title": "No hay revisión"})
    assert error.value.status_code == 503


def test_legacy_publish_rejects_second_published_version():
    conn = Conn(published=True)
    with pytest.raises(HTTPException) as error:
        run_change(conn, changes={"status": "published"})
    assert error.value.status_code == 409


def test_draft_routes_are_registered_but_require_authentication():
    root = f"/api/v1/academic/organizations/{ORG}"
    with TestClient(app) as client:
        for suffix in (f"/lessons/{LESSON}/draft", f"/offering-lessons/{LESSON}/draft"):
            response = client.get(root + suffix)
            assert response.status_code == 401


def test_invalid_editor_document_rejected_before_sql():
    """Pydantic no permite HTML arbitrario aun cuando exista autenticación."""
    root = f"/api/v1/academic/organizations/{ORG}"
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: object()
    try:
        with TestClient(app) as client:
            response = client.patch(root + f"/lessons/{LESSON}/draft", json={
                "title": "Contenido no seguro", "expected_lock_version": 1,
                "document": {"type": "doc", "content": [{"type": "iframe"}]},
            })
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_base_editor_denied_before_lesson_lookup(monkeypatch):
    """Los docentes no pueden obtener metadatos de lecciones institucionales."""
    from app.routers import lesson_revisions as drafts

    async def denied(*_args, **_kwargs):
        raise HTTPException(status_code=403, detail="Sin permiso de gestión")

    async def would_leak(*_args, **_kwargs):
        raise AssertionError("No debe consultar la lección institucional")

    monkeypatch.setattr(drafts, "_require_scope", denied)
    monkeypatch.setattr(drafts, "_course_from_lesson", would_leak)
    with pytest.raises(HTTPException) as error:
        asyncio.run(drafts._authorize(Conn(), ACTOR, ORG, LESSON, "institutional"))
    assert error.value.status_code == 403


def test_foreign_member_denied_before_offering_lookup(monkeypatch):
    """La API con BYPASSRLS verifica primero la pertenencia institucional."""
    from app.routers import lesson_revisions as drafts

    async def denied(*_args, **_kwargs):
        raise HTTPException(status_code=404, detail="Institución no disponible")

    async def would_leak(*_args, **_kwargs):
        raise AssertionError("No debe consultar ofertas antes de validar el tenant")

    monkeypatch.setattr(drafts, "_actor_scope", denied)
    monkeypatch.setattr(drafts, "_offering_from_lesson", would_leak)
    with pytest.raises(HTTPException) as error:
        asyncio.run(drafts._authorize(Conn(), ACTOR, ORG, LESSON, "offering"))
    assert error.value.status_code == 404


def test_unassigned_teacher_cannot_read_private_draft(monkeypatch):
    from app.routers import lesson_revisions as drafts

    async def actor(*_args, **_kwargs):
        return {"actor_id": ACTOR, "is_manager": False}

    async def offering(*_args, **_kwargs):
        return LESSON

    async def denied(*_args, **_kwargs):
        raise HTTPException(status_code=403, detail="Docente no asignado")

    monkeypatch.setattr(drafts, "_actor_scope", actor)
    monkeypatch.setattr(drafts, "_offering_from_lesson", offering)
    monkeypatch.setattr(drafts, "_editor", denied)
    with pytest.raises(HTTPException) as error:
        asyncio.run(drafts._get(Conn(), ACTOR, ORG, LESSON, "offering"))
    assert error.value.status_code == 403
