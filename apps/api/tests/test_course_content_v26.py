"""v26: permisos de lectura/edición y orden transaccional, sin red ni Supabase.

Las conexiones falsas comprueban las consultas: no sustituyen las pruebas de
integración posteriores a la migración 007 en la instancia del usuario.
"""
from uuid import UUID

from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
COURSE = UUID("33333333-3333-4333-8333-333333333333")
OFFER = UUID("44444444-4444-4444-8444-444444444444")
UNIT = UUID("55555555-5555-4555-8555-555555555555")
UNIT_2 = UUID("66666666-6666-4666-8666-666666666666")
LESSON = UUID("77777777-7777-4777-8777-777777777777")
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


class Connection:
    def __init__(self, *, accessible=True, manager=False, assigned=False,
                 enrolled=False, course_published=True, course_exists=True,
                 offering_exists=True, module_exists=True, lesson_exists=True,
                 moving=False, unit_count=2, current_status="draft"):
        self.accessible = accessible
        self.manager = manager
        self.assigned = assigned
        self.enrolled = enrolled
        self.course_published = course_published
        self.course_exists = course_exists
        self.offering_exists = offering_exists
        self.module_exists = module_exists
        self.lesson_exists = lesson_exists
        self.moving = moving
        self.unit_count = unit_count
        self.current_status = current_status
        self.statements = []

    async def execute(self, statement, params=None):
        query = str(statement)
        self.statements.append((query, params or {}))
        if "AS is_global_admin" in query:
            return Result({"actor_id": ACTOR, "is_global_admin": False,
                           "is_member": self.accessible, "is_manager": self.manager})
        if "AS assigned" in query and "AS enrolled" in query:
            if not self.offering_exists:
                return Result()
            return Result({"offering_id": str(OFFER), "course_id": str(COURSE),
                           "title": "Cálculo", "code": "mat101", "description": "Programa",
                           "course_status": "published" if self.course_published else "draft",
                           "offering_status": "open", "period": "2026-II",
                           "appearance_icon": "calculator", "appearance_color": "blue",
                           "assigned": self.assigned, "enrolled": self.enrolled})
        if "FROM app.courses c WHERE" in query:
            return Result({"course_id": str(COURSE), "title": "Cálculo", "code": "mat101",
                           "description": None, "course_status": "published",
                           "appearance_icon": "calculator", "appearance_color": "blue"} if self.course_exists else None)
        if "FROM app.course_modules" in query and "SELECT id::text AS id" in query:
            return Result(rows=[{"id": str(UNIT), "title": "Unidad 1", "description": None,
                                 "position": 1, "status": "published", "updated_at": "2026-01-01"}])
        if "FROM app.lessons l" in query and "l.module_id::text" in query:
            return Result(rows=[{"id": str(LESSON), "module_id": str(UNIT),
                                 "title": "Lección 1", "content": "Contenido público", "position": 1,
                                 "status": "published", "updated_at": "2026-01-01"}])
        if "SELECT id FROM app.courses" in query:
            return Result((COURSE,) if self.course_exists else None)
        if "SELECT course_id FROM app.course_modules" in query:
            return Result({"course_id": COURSE} if self.module_exists else None)
        if "SELECT m.course_id FROM app.lessons" in query:
            return Result({"course_id": COURSE} if self.lesson_exists else None)
        if "MAX(position)" in query:
            return Result(1)
        if "INSERT INTO app.course_modules" in query:
            return Result({"id": str(UNIT), "title": params["title"],
                           "description": params.get("description"), "position": params["position"],
                           "status": "draft"})
        if "INSERT INTO app.lessons" in query:
            return Result({"id": str(LESSON), "module_id": str(UNIT),
                           "title": params["title"], "content": params.get("content"),
                           "position": params["position"], "status": "draft"})
        if "SELECT status FROM app.course_modules" in query:
            return Result({"status": self.current_status})
        if "SELECT status, title, content FROM app.lessons" in query:
            return Result({"status": self.current_status, "title": "Lección 1", "content": "Contenido de prueba"})
        if "UPDATE app.course_modules SET" in query and "RETURNING" in query:
            return Result({"id": str(UNIT), "title": params.get("title", "Unidad 1"),
                           "description": params.get("description"), "position": 1,
                           "status": params.get("status", "draft")})
        # Simulador de revisiones v29.1: la compatibilidad se prueba en
        # tests especializados además de mantener las pruebas v26.
        if "FROM app.lesson_revisions" in query and "revision_state=:state" in query:
            return Result({"id": LESSON, "title": "Lección 1", "document_body": "Contenido",
                           "document_format": "plain-text-v1", "lock_version": 1,
                           "revision_number": None, "base_revision_id": None,
                           "legacy_content_was_null": False}
                          if params["state"] == "draft" else None)
        if "SELECT COALESCE(MAX(revision_number)" in query:
            return Result(1)
        if "INSERT INTO app.lesson_revisions" in query or "UPDATE app.lesson_revisions" in query:
            return Result()
        if "UPDATE app.lessons SET" in query and "RETURNING" in query:
            return Result({"id": str(LESSON), "module_id": str(UNIT),
                           "title": params.get("title", "Lección 1"),
                           "content": params.get("content"), "position": 1,
                           "status": params.get("status", "draft")})
        if "ORDER BY position FOR UPDATE" in query:
            return Result(rows=[{"id": UNIT, "position": 1},
                                {"id": UNIT_2, "position": 2}][:self.unit_count])
        return Result()


class Context:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *_args):
        return False


class Engine:
    def __init__(self, **options):
        self.conn = Connection(**options)

    def begin(self):
        return Context(self.conn)

    def connect(self):
        return Context(self.conn)


def call(method, endpoint, engine=None, body=None):
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: engine or Engine()
    try:
        with TestClient(app) as client:
            return client.request(method, ROOT + endpoint, json=body)
    finally:
        app.dependency_overrides.clear()


def test_student_sees_published_content_in_own_offering_only():
    engine = Engine(enrolled=True)
    response = call("GET", f"/course-offerings/{OFFER}/workspace", engine)
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "student"
    assert response.json()["units"][0]["lessons"][0]["title"] == "Lección 1"
    assert response.json()["can_edit_base"] is False
    content_queries = [(sql, params) for sql, params in engine.conn.statements
                       if "FROM app.course_modules" in sql and "SELECT id::text" in sql]
    assert content_queries and content_queries[0][1]["preview"] is False
    assert "status='published'" in content_queries[0][0]


def test_student_without_enrollment_cannot_open_offering():
    engine = Engine()
    assert call("GET", f"/course-offerings/{OFFER}/workspace", engine).status_code == 403
    assert not any("FROM app.course_modules" in sql for sql, _ in engine.conn.statements)


def test_foreign_institution_cannot_open_offering():
    assert call("GET", f"/course-offerings/{OFFER}/workspace",
                Engine(accessible=False, enrolled=True)).status_code == 404


def test_student_cannot_open_unpublished_course():
    assert call("GET", f"/course-offerings/{OFFER}/workspace",
                Engine(enrolled=True, course_published=False)).status_code == 404


def test_instructor_needs_active_assignment_and_may_preview_drafts():
    engine = Engine(assigned=True)
    response = call("GET", f"/course-offerings/{OFFER}/workspace", engine)
    assert response.status_code == 200
    assert response.json()["role"] == "instructor"
    assert not response.json()["can_edit_base"]
    sql = [(s, p) for s, p in engine.conn.statements if "FROM app.course_modules" in s and "SELECT id::text" in s]
    assert sql[0][1]["preview"] is True
    assert call("GET", f"/course-offerings/{OFFER}/workspace", Engine()).status_code == 403


def test_manager_can_edit_base_and_see_drafts():
    engine = Engine(manager=True)
    response = call("GET", f"/courses/{COURSE}/workspace", engine)
    assert response.status_code == 200
    assert response.json()["can_edit_base"] is True
    sql = [(s, p) for s, p in engine.conn.statements if "FROM app.course_modules" in s and "SELECT id::text" in s]
    assert sql[0][1]["preview"] is True


def test_non_manager_cannot_read_editor_even_if_assigned():
    assert call("GET", f"/courses/{COURSE}/workspace", Engine(assigned=True)).status_code == 403


def test_manager_creates_module_transactionally_and_audits():
    engine = Engine(manager=True)
    response = call("POST", f"/courses/{COURSE}/modules", engine,
                    {"title": "Unidad 2", "description": "Teoría"})
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "draft"
    inserts = [params for sql, params in engine.conn.statements if "INSERT INTO app.course_modules" in sql]
    assert len(inserts) == 1 and inserts[0]["org"] == ORG and inserts[0]["course_id"] == COURSE
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in engine.conn.statements)


def test_teacher_cannot_modify_shared_course_content():
    engine = Engine(assigned=True)
    response = call("POST", f"/courses/{COURSE}/modules", engine, {"title": "Invasión de datos"})
    assert response.status_code == 403
    assert not any("INSERT INTO app.course_modules" in sql for sql, _ in engine.conn.statements)


def test_manager_creates_lesson_and_audits():
    engine = Engine(manager=True)
    response = call("POST", f"/course-modules/{UNIT}/lessons", engine,
                    {"title": "Lección 2", "content": "Texto plano"})
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "draft"
    assert any("INSERT INTO app.lessons" in sql for sql, _ in engine.conn.statements)
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in engine.conn.statements)


def test_publishing_and_archiving_are_audited():
    engine = Engine(manager=True)
    for method, path, state in (
        ("PATCH", f"/course-modules/{UNIT}", "published"),
        ("PATCH", f"/lessons/{LESSON}", "archived"),
    ):
        response = call(method, path, engine, {"status": state})
        assert response.status_code == 200, response.text
        assert response.json()["status"] == state
    assert len([1 for sql, _ in engine.conn.statements if "INSERT INTO app.audit_logs" in sql]) == 2


def test_validation_rejects_invalid_status_extra_fields_and_null_title():
    for path, data in (
        (f"/course-modules/{UNIT}", {"status": "deleted"}),
        (f"/course-modules/{UNIT}", {"title": None}),
        (f"/lessons/{LESSON}", {"title": None}),
        (f"/course-modules/{UNIT}", {"course_id": str(COURSE)}),
    ):
        assert call("PATCH", path, Engine(manager=True), data).status_code == 422


def test_move_swaps_with_temporary_positive_position_and_audit():
    engine = Engine(manager=True)
    response = call("PATCH", f"/courses/{COURSE}/modules/{UNIT}/move", engine,
                    {"direction": "down"})
    assert response.status_code == 200, response.text
    assert response.json()["changed"] is True
    changes = [params for sql, params in engine.conn.statements
               if "UPDATE app.course_modules SET position" in sql]
    assert [p["position"] for p in changes] == [3, 1, 2]
    assert all(p["org"] == ORG and p["parent_id"] == COURSE for p in changes)
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in engine.conn.statements)


def test_move_at_boundary_does_not_write():
    engine = Engine(manager=True)
    response = call("PATCH", f"/courses/{COURSE}/modules/{UNIT}/move", engine, {"direction": "up"})
    assert response.status_code == 200
    assert response.json() == {"changed": False}
    assert not any("UPDATE app.course_modules SET position" in sql for sql, _ in engine.conn.statements)


def test_invalid_lesson_or_module_stays_hidden():
    assert call("PATCH", f"/lessons/{LESSON}", Engine(manager=True, lesson_exists=False),
                {"status": "published"}).status_code == 404
    assert call("POST", f"/course-modules/{UNIT}/lessons", Engine(manager=True,module_exists=False),
                {"title": "Cualquier cosa"}).status_code == 404


def test_requires_authentication_without_overrides():
    with TestClient(app) as client:
        response = client.get(ROOT + f"/course-offerings/{OFFER}/workspace")
    assert response.status_code == 401


def test_published_material_requires_unpublish_before_text_edits():
    for route, changed in (
        (f"/course-modules/{UNIT}", {"title": "Revisado"}),
        (f"/lessons/{LESSON}", {"content": "Cambio no versionado"}),
    ):
        engine = Engine(manager=True, current_status="published")
        response = call("PATCH", route, engine, changed)
        assert response.status_code == 409, response.text
        assert not any("UPDATE app.course_modules SET" in sql or "UPDATE app.lessons SET" in sql
                       for sql, _ in engine.conn.statements)
    # v29.1: publicado -> borrador está prohibido; se crea un borrador de
    # revisión independiente, manteniendo la publicación visible.
    response = call("PATCH", f"/lessons/{LESSON}", Engine(manager=True, current_status="published"),
                    {"status": "draft"})
    assert response.status_code == 409
