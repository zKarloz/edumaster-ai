"""v27 · Autonomía docente, aislamiento por oferta, estado y rutas.

Estas pruebas usan conexiones simuladas: los ensayos de RLS/SQL reales deben
realizarse contra Supabase una vez aplicada la migración 008.
"""

import asyncio
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app
from app.routers.offering_content import offering_units

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
COURSE = UUID("33333333-3333-4333-8333-333333333333")
OFFER = UUID("44444444-4444-4444-8444-444444444444")
UNIT = UUID("55555555-5555-4555-8555-555555555555")
LESSON = UUID("66666666-6666-4666-8666-666666666666")
ROOT = f"/api/v1/academic/organizations/{ORG}"


class Result:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def mappings(self):
        return self

    def first(self):
        return self.row

    def one(self):
        return self.row

    def scalar_one(self):
        return self.row

    def all(self):
        return self.rows


class Conn:
    def __init__(self, *, manager=False, assigned=False, member=True,
                 offer_status="open", course_status="published", has_module=True,
                 active_enrollments=False):
        self.manager = manager
        self.assigned = assigned
        self.member = member
        self.offer_status = offer_status
        self.course_status = course_status
        self.has_module = has_module
        self.active_enrollments = active_enrollments
        self.queries = []

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.queries.append((sql, params or {}))
        if "AS is_global_admin" in sql:
            return Result({"actor_id": ACTOR, "is_global_admin": False,
                           "is_member": self.member, "is_manager": self.manager})
        if "AS assigned" in sql and "FROM app.course_offerings off" in sql:
            return Result({"id": OFFER, "status": self.offer_status,
                           "course_status": self.course_status, "assigned": self.assigned})
        if "SELECT offering_id FROM app.offering_modules" in sql:
            return Result({"offering_id": OFFER} if self.has_module else None)
        if "SELECT m.offering_id FROM app.offering_lessons" in sql:
            return Result({"offering_id": OFFER} if self.has_module else None)
        if "SELECT id FROM app.offering_modules" in sql:
            return Result((UNIT,) if self.has_module else None)
        if "MAX(position)" in sql:
            return Result(1)
        if "SELECT status FROM app.offering_modules" in sql or "SELECT status FROM app.offering_lessons" in sql:
            return Result({"status": "draft"})
        if "INSERT INTO app.offering_modules" in sql:
            return Result({"id": str(UNIT), "title": params["title"],
                           "description": params["description"], "position": params["position"],
                           "status": "draft"})
        if "INSERT INTO app.offering_lessons" in sql:
            return Result({"id": str(LESSON), "module_id": str(UNIT),
                           "title": params["title"], "content": params["content"],
                           "position": params["position"], "status": "draft"})
        if "UPDATE app.offering_modules SET" in sql:
            return Result({"id": str(UNIT), "title": "Unidad nueva", "position": 1,
                           "description": None, "status": params.get("status", "draft")})
        if "UPDATE app.offering_lessons SET" in sql:
            return Result({"id": str(LESSON), "module_id": str(UNIT),
                           "title": "Lección nueva", "content": None, "position": 1,
                           "status": params.get("status", "draft")})
        if "SELECT id, position FROM app.offering_" in sql:
            return Result(rows=[{"id": UNIT, "position": 1},
                                {"id": LESSON, "position": 2}])
        if "SELECT EXISTS" in sql and "app.enrollments" in sql:
            return Result(self.active_enrollments)
        if "UPDATE app.courses SET status=" in sql:
            return Result({"id": str(COURSE), "status": params["state"]})
        if ("FROM app.offering_modules" in sql and "id::text AS id" in sql
                and ":preview OR status='published'" in sql):
            return Result(rows=[{"id": str(UNIT), "title": "Taller docente", "position": 1,
                                 "description": None, "status": "published", "updated_at": "2026-11-01"}])
        if "FROM app.offering_lessons l" in sql:
            return Result(rows=[{"id": str(LESSON), "module_id": str(UNIT),
                                 "title": "Material", "content": "Contenido", "position": 1,
                                 "status": "published", "updated_at": "2026-11-01"}])
        return Result()


class Context:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *_args):
        return False


class Engine:
    def __init__(self, **opts):
        self.conn = Conn(**opts)

    def begin(self):
        return Context(self.conn)

    def connect(self):
        return Context(self.conn)


def request(path, method="post", payload=None, engine=None):
    db = engine or Engine()
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: db
    try:
        with TestClient(app) as client:
            response = client.request(method.upper(), ROOT + path, json=payload)
        return response, db
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("method,path,payload", [
    ("post", f"/course-offerings/{OFFER}/modules", {"title": "Unidad nueva"}),
    ("patch", f"/offering-modules/{UNIT}", {"title": "Unidad actualizada"}),
    ("post", f"/offering-modules/{UNIT}/lessons", {"title": "Lección nueva"}),
    ("patch", f"/offering-lessons/{LESSON}", {"title": "Lección actualizada"}),
    ("patch", f"/course-offerings/{OFFER}/modules/{UNIT}/move", {"direction": "down"}),
    ("patch", f"/offering-modules/{UNIT}/lessons/{LESSON}/move", {"direction": "down"}),
])
def test_unassigned_teacher_cannot_modify_offering(method, path, payload):
    response, db = request(path, method, payload, Engine())
    assert response.status_code == 403, response.text
    assert not any("INSERT INTO app.offering_" in sql or "UPDATE app.offering_" in sql
                   for sql, _ in db.conn.queries)


@pytest.mark.parametrize("method,path,payload", [
    ("post", f"/course-offerings/{OFFER}/modules", {"title": "Unidad nueva"}),
    ("post", f"/offering-modules/{UNIT}/lessons", {"title": "Lección nueva"}),
    ("patch", f"/offering-modules/{UNIT}", {"status": "published"}),
    ("patch", f"/offering-lessons/{LESSON}", {"status": "published"}),
])
def test_assigned_teacher_can_manage_own_offering(method, path, payload):
    response, db = request(path, method, payload, Engine(assigned=True))
    assert response.status_code in (200, 201), response.text
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in db.conn.queries)
    assert not any("UPDATE app.course_modules" in sql or "UPDATE app.lessons" in sql
                   for sql, _ in db.conn.queries)


@pytest.mark.parametrize("options,expected", [
    ({"member": False, "assigned": True}, 404),
    ({"assigned": True, "offer_status": "closed"}, 409),
    ({"assigned": True, "offer_status": "cancelled"}, 409),
    ({"assigned": True, "course_status": "archived"}, 409),
])
def test_scope_and_closed_offers(options, expected):
    response, _ = request(f"/course-offerings/{OFFER}/modules", "post",
                          {"title": "Unidad nueva"}, Engine(**options))
    assert response.status_code == expected


def test_unassigned_teacher_cannot_edit_base():
    response, _ = request(f"/courses/{COURSE}/modules", "post",
                          {"title": "Intento de edición"}, Engine(assigned=True))
    assert response.status_code == 403


def test_editor_can_reject_bad_status_and_inputs():
    response, _ = request(f"/course-offerings/{OFFER}/modules", "post",
                          {"title": "No"}, Engine(assigned=True))
    assert response.status_code == 422
    response, _ = request(f"/offering-modules/{UNIT}", "patch",
                          {"status": "invalid"}, Engine(assigned=True))
    assert response.status_code == 422


def test_offering_content_queries_are_tenant_scoped_and_publication_filtered():
    conn = Conn(assigned=True)
    result = asyncio.run(offering_units(conn, ORG, OFFER, preview=False))
    assert result and result[0]["source"] == "offering"
    assert result[0]["lessons"][0]["title"] == "Material"
    for sql, params in conn.queries:
        assert "organization_id=:org" in sql or "l.organization_id=:org" in sql
        assert params["org"] == ORG and params["offering_id"] == OFFER
        assert ":preview OR" in sql and params["preview"] is False


def test_manager_can_archive_inactive_course_without_deletion():
    response, db = request(f"/courses/{COURSE}/status", "patch",
                           {"status": "archived"}, Engine(manager=True))
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "archived"
    assert any("UPDATE app.courses SET status" in sql for sql, _ in db.conn.queries)
    assert not any("DELETE FROM app." in sql for sql, _ in db.conn.queries)


def test_manager_cannot_archive_course_with_active_enrollments():
    response, _ = request(f"/courses/{COURSE}/status", "patch",
                          {"status": "archived"}, Engine(manager=True, active_enrollments=True))
    assert response.status_code == 409


def test_teacher_cannot_change_course_state():
    response, _ = request(f"/courses/{COURSE}/status", "patch",
                          {"status": "archived"}, Engine(assigned=True))
    assert response.status_code == 403


def test_draft_cannot_hide_course_with_active_students():
    response, _ = request(f"/courses/{COURSE}/status", "patch",
                          {"status": "draft"}, Engine(manager=True, active_enrollments=True))
    assert response.status_code == 409


def test_archived_filter_is_applied_server_side_to_course_status():
    response, db = request("/course-offerings?course_status=archived", "get",
                           engine=Engine(manager=True))
    assert response.status_code == 200, response.text
    sqls = [(sql, params) for sql, params in db.conn.queries
            if "c.status=CAST(:course_status AS text)" in sql]
    assert sqls
    assert all(params["course_status"] == "archived" for _, params in sqls)


def test_student_catalog_never_includes_archived_courses():
    response, db = request("/my-courses", "get", engine=Engine(member=True))
    assert response.status_code == 200, response.text
    assert any("AND c.status='published'" in sql for sql, _ in db.conn.queries)
