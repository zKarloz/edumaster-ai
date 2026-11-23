"""Regresiones v21: la personalización respeta identidad, tenant y rol.

Se usan conexiones falsas sin enviar credenciales ni datos a Supabase.
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
ROOT = f"/api/v1/academic/organizations/{ORG}"


class Result:
    def __init__(self, row=None):
        self.row = row

    def mappings(self):
        return self

    def first(self):
        return self.row


class Connection:
    def __init__(self, *, accessible=True, manager=True, assigned=False,
                 course_exists=True, offering_exists=True):
        self.accessible = accessible
        self.manager = manager
        self.assigned = assigned
        self.course_exists = course_exists
        self.offering_exists = offering_exists
        self.statements = []

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.statements.append((sql, params or {}))
        if "AS is_global_admin" in sql:
            return Result({"actor_id": ACTOR, "is_global_admin": False,
                           "is_member": self.accessible, "is_manager": self.manager})
        if "UPDATE app.courses" in sql:
            return Result({"id": COURSE, "appearance_icon": params["icon"],
                           "appearance_color": params["color"]} if self.course_exists else None)
        if "AS assigned" in sql and "FROM app.course_offerings off" in sql:
            return Result({"id": OFFER, "assigned": self.assigned} if self.offering_exists else None)
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


def request(path, engine, *, method="patch", payload=None):
    app.dependency_overrides[authenticated_user_id] = lambda: ACTOR
    app.dependency_overrides[require_engine] = lambda: engine
    try:
        with TestClient(app) as client:
            return getattr(client, method)(ROOT + path, json=payload) if payload is not None else (
                getattr(client, method)(ROOT + path))
    finally:
        app.dependency_overrides.clear()


def test_manager_updates_course_default_with_audit():
    engine = Engine(manager=True)
    response = request(f"/courses/{COURSE}/appearance", engine,
                       payload={"icon": "calculator", "color": "blue"})
    assert response.status_code == 200, response.text
    assert response.json()["icon"] == "calculator"
    assert any("UPDATE app.courses" in sql and params["organization_id"] == ORG
               and params["course_id"] == COURSE for sql, params in engine.conn.statements)
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in engine.conn.statements)


def test_student_cannot_edit_course_default():
    engine = Engine(manager=False)
    response = request(f"/courses/{COURSE}/appearance", engine,
                       payload={"icon": "calculator", "color": "blue"})
    assert response.status_code == 403
    assert not any("UPDATE app.courses" in sql for sql, _ in engine.conn.statements)


def test_cross_tenant_user_cannot_change_appearance():
    engine = Engine(accessible=False)
    response = request(f"/courses/{COURSE}/appearance", engine,
                       payload={"icon": "calculator", "color": "blue"})
    assert response.status_code == 404


def test_unknown_course_cannot_be_updated():
    response = request(f"/courses/{COURSE}/appearance", Engine(course_exists=False),
                       payload={"icon": "book-open", "color": "teal"})
    assert response.status_code == 404


def test_rejects_arbitrary_colors_icons_and_foreign_fields():
    for payload in (
        {"icon": "<script>", "color": "blue"},
        {"icon": "book-open", "color": "#000000"},
        {"icon": "book-open", "color": "blue", "organization_id": str(ORG)},
    ):
        response = request(f"/courses/{COURSE}/appearance", Engine(), payload=payload)
        assert response.status_code == 422


def test_teacher_can_customize_assigned_offering():
    engine = Engine(manager=False, assigned=True)
    response = request(f"/course-offerings/{OFFER}/appearance", engine, method="put",
                       payload={"icon": "atom", "color": "purple"})
    assert response.status_code == 200, response.text
    assert response.json()["overridden"] is True
    assert any("UPDATE app.course_offerings" in sql and params["offering_id"] == OFFER
               and params["organization_id"] == ORG for sql, params in engine.conn.statements)
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in engine.conn.statements)


def test_unassigned_teacher_cannot_customize_offering():
    engine = Engine(manager=False, assigned=False)
    response = request(f"/course-offerings/{OFFER}/appearance", engine, method="put",
                       payload={"icon": "atom", "color": "purple"})
    assert response.status_code == 403
    assert not any("UPDATE app.course_offerings" in sql for sql, _ in engine.conn.statements)


def test_manager_without_teacher_assignment_cannot_customize_offering():
    # Regla aprobada: los gestores editan el curso BASE, el docente su OFERTA.
    response = request(f"/course-offerings/{OFFER}/appearance", Engine(manager=True), method="put",
                       payload={"icon": "atom", "color": "purple"})
    assert response.status_code == 403


def test_offering_other_tenant_or_cancelled_is_hidden():
    response = request(f"/course-offerings/{OFFER}/appearance",
                       Engine(manager=False, assigned=True, offering_exists=False), method="put",
                       payload={"icon": "atom", "color": "purple"})
    assert response.status_code == 404


def test_teacher_restores_inheritance_and_audits():
    engine = Engine(manager=False, assigned=True)
    response = request(f"/course-offerings/{OFFER}/appearance", engine, method="delete")
    assert response.status_code == 200, response.text
    assert response.json()["overridden"] is False
    assert any("appearance_icon_override=NULL" in sql and "appearance_color_override=NULL" in sql
               for sql, _ in engine.conn.statements)
    assert any("INSERT INTO app.audit_logs" in sql for sql, _ in engine.conn.statements)


def test_only_assigned_teacher_can_restore_inheritance():
    response = request(f"/course-offerings/{OFFER}/appearance", Engine(manager=False),
                       method="delete")
    assert response.status_code == 403


def test_tenant_id_is_bound_in_every_write():
    engine = Engine(manager=True)
    request(f"/courses/{COURSE}/appearance", engine,
            payload={"icon": "languages", "color": "teal"})
    writes = [(sql, params) for sql, params in engine.conn.statements
              if "UPDATE app.courses" in sql or "INSERT INTO app.audit_logs" in sql]
    assert writes
    assert all(params["organization_id"] == ORG for _, params in writes)
