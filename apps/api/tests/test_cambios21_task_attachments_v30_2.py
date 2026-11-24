"""CAMBIOS 21 v30.2: adjuntos privados, permisos y vinculación atómica.

Sin dependencia de pytest-asyncio ni secretos: mocks de PostgreSQL y Storage.
"""

import asyncio
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.routers import course_tasks as tasks
from app.routers import task_attachments as attachments

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")
OFFER = UUID("33333333-3333-4333-8333-333333333333")
TASK = UUID("44444444-4444-4444-8444-444444444444")
ENROLL = UUID("55555555-5555-4555-8555-555555555555")
SUBMISSION = UUID("66666666-6666-4666-8666-666666666666")
FILE = UUID("77777777-7777-4777-8777-777777777777")


class Result:
    def __init__(self, value=None, items=None):
        self.value = value
        self.items = items or []

    def mappings(self):
        return self

    def first(self):
        return self.value

    def all(self):
        return self.items

    def scalar_one(self):
        return self.value


class Conn:
    def __init__(self, pending=0, attempts=0, available=True):
        self.pending = pending
        self.attempts = attempts
        self.available = available
        self.sql = []

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.sql.append((sql, params or {}))
        if "SELECT count(*) FROM app.task_submission_files" in sql:
            return Result(self.pending)
        if "SELECT count(*) FROM app.task_submissions" in sql:
            return Result(self.attempts)
        if "SELECT id FROM app.enrollments" in sql:
            return Result({"id": ENROLL})
        if "INSERT INTO app.task_submissions" in sql:
            return Result({"id": SUBMISSION, "status": "submitted", "attempt_number": 1})
        if "SELECT id FROM app.task_submissions" in sql:
            return Result({"id": SUBMISSION} if self.available else None)
        if "SELECT f.object_path FROM app.task_submission_files" in sql:
            return Result({"object_path": f"{ORG}/task-submissions/{TASK}/{FILE}.pdf"}
                          if self.available else None)
        return Result()


class Engine:
    def __init__(self, connection):
        self.connection = connection

    def connect(self):
        return self

    def begin(self):
        return self

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *_):
        return None


def ctx(*, editor=False, enroll=ENROLL, active="active"):
    return {"editor": editor, "actor": ACTOR, "enrollment_id": enroll,
            "enrollment_status": active, "offering_status": "open",
            "course_status": "published"}


@pytest.fixture
def mock_tasks(monkeypatch):
    async def context(*_args):
        return ctx()

    async def task(*_args, **_kwargs):
        return {"id": TASK, "status": "published", "due_at": None, "max_attempts": 2}

    async def audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(tasks, "_context", context)
    monkeypatch.setattr(tasks, "_task", task)
    monkeypatch.setattr(tasks, "_audit", audit)
    monkeypatch.setattr(attachments, "_context", context)
    monkeypatch.setattr(attachments, "_task", task)
    monkeypatch.setattr(attachments, "_audit", audit)


def test_file_only_submission_binds_pending_to_exact_attempt(mock_tasks):
    connection = Conn(pending=2)
    result = asyncio.run(tasks.submit_task(
        ORG, OFFER, TASK, tasks.AnswerInput(answer_text=""), ACTOR, Engine(connection),
    ))
    assert result["attachment_count"] == 2
    bind = next((sql, data) for sql, data in connection.sql
                if "UPDATE app.task_submission_files" in sql)
    assert "submission_id IS NULL" in bind[0]
    assert bind[1]["submission_id"] == SUBMISSION
    assert bind[1]["enrollment_id"] == ENROLL
    assert bind[1]["offering_id"] == OFFER
    assert bind[1]["task_id"] == TASK


def test_no_text_and_no_attachments_is_rejected(mock_tasks):
    with pytest.raises(HTTPException) as error:
        asyncio.run(tasks.submit_task(
            ORG, OFFER, TASK, tasks.AnswerInput(answer_text="  "), ACTOR, Engine(Conn()),
        ))
    assert error.value.status_code == 422


def test_text_delivery_still_works_without_attachments(mock_tasks):
    result = asyncio.run(tasks.submit_task(
        ORG, OFFER, TASK, tasks.AnswerInput(answer_text="Respuesta"), ACTOR, Engine(Conn()),
    ))
    assert result["attachment_count"] == 0


def test_stage_policy_rejects_exceeded_limit_and_attempts(mock_tasks):
    with pytest.raises(HTTPException) as error:
        asyncio.run(attachments._stage_policy(Conn(pending=3), ACTOR, ORG, OFFER, TASK))
    assert error.value.status_code == 409
    with pytest.raises(HTTPException) as error:
        asyncio.run(attachments._stage_policy(Conn(attempts=2), ACTOR, ORG, OFFER, TASK))
    assert error.value.status_code == 409


def test_staging_forbidden_without_enrollment(monkeypatch, mock_tasks):
    async def context(*_args):
        return ctx(editor=True, enroll=None)

    monkeypatch.setattr(attachments, "_context", context)
    with pytest.raises(HTTPException) as error:
        asyncio.run(attachments._stage_policy(Conn(), ACTOR, ORG, OFFER, TASK))
    assert error.value.status_code == 403


def test_staging_rejects_bad_signature_before_storage(monkeypatch, mock_tasks):
    async def upload(*_args):
        pytest.fail("Nunca debe llegar a Supabase Storage")

    class Request:
        # Cabeceras de la solicitud de prueba aisladas por instancia.
        def __init__(self):
            self.headers = {"content-type": "application/pdf"}

        async def stream(self):
            yield b"esto no es un PDF"

    monkeypatch.setattr(attachments, "_upload_object", upload)
    with pytest.raises(HTTPException) as error:
        asyncio.run(attachments.upload_task_attachment(
            ORG, OFFER, TASK, Request(), "entrega.pdf", ACTOR, Engine(Conn()),
        ))
    assert error.value.status_code == 415


def test_submission_scope_excludes_other_student(monkeypatch, mock_tasks):
    connection = Conn(available=False)
    with pytest.raises(HTTPException) as error:
        asyncio.run(attachments._submission_policy(
            connection, ACTOR, ORG, OFFER, TASK, SUBMISSION,
        ))
    assert error.value.status_code == 404
    clause = next((sql, args) for sql, args in connection.sql
                  if "SELECT id FROM app.task_submissions" in sql)
    assert "(:editor OR enrollment_id=:enrollment_id)" in clause[0]
    assert clause[1]["enrollment_id"] == ENROLL
    assert clause[1]["editor"] is False


def test_signing_only_after_authorization(monkeypatch, mock_tasks):
    async def signed(_path):
        return "https://supabase.example/storage/v1/object/sign/course-resources/file?token=test"

    monkeypatch.setattr(attachments, "_signed_download", signed)
    result = asyncio.run(attachments.download_submission_attachment(
        ORG, OFFER, TASK, SUBMISSION, FILE, ACTOR, Engine(Conn()),
    ))
    assert result["expires_in"] == 60
    assert "/object/sign/" in result["url"]


def test_endpoints_require_authenticated_user():
    client = TestClient(app)
    base = f"/api/v1/academic/organizations/{ORG}/course-offerings/{OFFER}/tasks/{TASK}"
    assert client.get(f"{base}/attachments/staged").status_code == 401
    assert client.post(f"{base}/attachments?filename=a.pdf",
                       content=b"%PDF-1.5", headers={"Content-Type": "application/pdf"}).status_code == 401
    assert client.get(f"{base}/submissions/{SUBMISSION}/attachments").status_code == 401
    assert client.get(f"{base}/submissions/{SUBMISSION}/attachments/{FILE}/download").status_code == 401
    assert client.delete(f"{base}/attachments/{FILE}").status_code == 401


def test_migration_blocks_cross_tenant_and_uses_existing_bucket():
    migration = Path(__file__).resolve().parents[3] / "database/migrations/012_task_submission_files.sql"
    content = migration.read_text(encoding="utf-8")
    assert "(organization_id,submission_id,task_id,enrollment_id,offering_id)" in content
    assert "(organization_id,enrollment_id,offering_id)" in content
    assert "FORCE ROW LEVEL SECURITY" in content
    assert "REVOKE ALL" in content
    assert "course-resources" in content
    assert "task_submissions_answer_text_check" in content


def test_successful_stage_uses_scoped_path_and_safe_response(monkeypatch, mock_tasks):
    calls = []

    async def upload(path, content, mime):
        calls.append((path, content, mime))

    class Request:
        # Cabeceras de la solicitud de prueba aisladas por instancia.
        def __init__(self):
            self.headers = {"content-type": "application/pdf"}

        async def stream(self):
            yield b"%PDF-1.7\n1 0 obj <<>>\nendobj"

    monkeypatch.setattr(attachments, "_upload_object", upload)
    item = asyncio.run(attachments.upload_task_attachment(
        ORG, OFFER, TASK, Request(), "evidencia.pdf", ACTOR, Engine(Conn()),
    ))
    assert item["filename"] == "evidencia.pdf"
    assert item["media_type"] == "application/pdf"
    assert "object_path" not in item
    assert "secret" not in str(item).lower()
    assert calls[0][0].startswith(f"{ORG}/task-submissions/{TASK}/")


def test_storage_orphan_compensated_if_state_changes(monkeypatch, mock_tasks):
    calls = {"checks": 0, "uploaded": [], "removed": []}

    async def stage_policy(*_args, **_kwargs):
        calls["checks"] += 1
        if calls["checks"] > 1:
            raise HTTPException(status_code=409, detail="Plazo vencido")
        return ACTOR, ENROLL

    async def upload(path, *_args):
        calls["uploaded"].append(path)

    async def remove(path):
        calls["removed"].append(path)

    class Request:
        # Cabeceras de la solicitud de prueba aisladas por instancia.
        def __init__(self):
            self.headers = {"content-type": "application/pdf"}

        async def stream(self):
            yield b"%PDF-1.7\n1 0 obj <<>>\nendobj"

    monkeypatch.setattr(attachments, "_stage_policy", stage_policy)
    monkeypatch.setattr(attachments, "_upload_object", upload)
    monkeypatch.setattr(attachments, "_remove_orphan", remove)
    with pytest.raises(HTTPException) as error:
        asyncio.run(attachments.upload_task_attachment(
            ORG, OFFER, TASK, Request(), "entrega.pdf", ACTOR, Engine(Conn()),
        ))
    assert error.value.status_code == 409
    assert len(calls["uploaded"]) == 1
    assert calls["uploaded"] == calls["removed"]
