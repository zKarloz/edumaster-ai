"""Pruebas aisladas de CSV, seguridad de roles y cliente privado Supabase Auth."""

import asyncio
from uuid import UUID

import httpx
import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.routers import user_invites
from app.services.user_invites import InviteItem, invite_auth_user, parse_csv_preview

ORG = UUID("11111111-1111-4111-8111-111111111111")
ACTOR = UUID("22222222-2222-4222-8222-222222222222")


def test_csv_valid_roles_and_quoted_name():
    result = parse_csv_preview('email,full_name,role\nJOSE@example.edu,"Pérez, José",student\n', frozenset({"student"}))
    assert result["total"] == result["valid"] == 1
    assert result["rows"][0]["full_name"] == "Pérez, José"
    assert result["rows"][0]["email"] == "jose@example.edu"


def test_csv_rejects_wrong_headers_and_oversize():
    with pytest.raises(HTTPException) as error:
        parse_csv_preview("password,email,role\nx,y,z\n", frozenset({"student"}))
    assert error.value.status_code == 422
    with pytest.raises(HTTPException) as error:
        parse_csv_preview("x" * 97_000, frozenset({"student"}))
    assert error.value.status_code == 413


def test_csv_flags_duplicate_and_non_delegable_roles():
    result = parse_csv_preview("email,full_name,role\na@site.edu,Juan Pérez,student\nA@site.edu,Otro Pérez,student\nb@site.edu,Administrador,director\nc@site.edu,Super Admin,institution_admin\n", frozenset({"student"}))
    assert result["valid"] == 1
    assert result["total"] == 4
    assert all(not row["valid"] for row in result["rows"][1:])


def test_item_rejects_unsafe_roles_and_format():
    with pytest.raises(ValueError):
        InviteItem(email="notanemail", full_name="Persona Prueba", role="student")
    with pytest.raises(ValueError):
        InviteItem(email="a@example.edu", full_name="Persona Prueba", role="superadmin")


def test_supabase_secret_only_apikey(monkeypatch):
    captured: dict = {}

    class FakeClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, url, **kwargs):
            captured["url"] = url
            captured["headers"] = kwargs["headers"]
            captured["body"] = kwargs["json"]
            return httpx.Response(200, json={"id": str(ACTOR)}, request=httpx.Request("POST", url))

    monkeypatch.setattr("app.services.user_invites.httpx.AsyncClient", FakeClient)
    item = InviteItem(email="a@example.edu", full_name="Persona Prueba", role="student")
    settings = Settings(supabase_url="https://myproject.supabase.co", supabase_secret_key="sb_secret_private")
    assert asyncio.run(invite_auth_user(settings, item)) == ACTOR
    assert captured["url"].endswith("/auth/v1/invite")
    assert captured["headers"]["apikey"] == "sb_secret_private"
    assert "Authorization" not in captured["headers"]
    assert "password" not in captured["body"]


def test_invite_does_not_call_auth_without_permissions(monkeypatch):
    class Conn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

    class Engine:
        def begin(self):
            return Conn()

    async def deny(*_):
        raise HTTPException(status_code=403, detail="Forbidden")

    called = False

    async def auth(*_):
        nonlocal called
        called = True
        return ACTOR

    monkeypatch.setattr(user_invites, "_authorize", deny)
    monkeypatch.setattr(user_invites, "invite_auth_user", auth)
    item = InviteItem(email="a@example.edu", full_name="Persona Prueba", role="student")
    with pytest.raises(HTTPException) as error:
        asyncio.run(user_invites._invite_one(Engine(), Settings(), ACTOR, ORG, item))
    assert error.value.status_code == 403
    assert not called


def test_bulk_rejects_duplicates_and_unconfirmed():
    from app.services.user_invites import ImportBatch

    with pytest.raises(ValueError):
        ImportBatch(confirmed=True, rows=[InviteItem(email="a@example.edu", full_name="Persona Prueba", role="student")] * 21)
    assert not ImportBatch(confirmed=False, rows=[InviteItem(email="a@example.edu", full_name="Persona Prueba", role="student")]).confirmed


def test_institution_admin_cannot_invite_other_institution_admin(monkeypatch):
    class Conn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

    class Engine:
        def begin(self):
            return Conn()

    async def is_admin(*_):
        return ACTOR, False

    async def should_not_run(*_):
        raise AssertionError("No debe consultar Auth ni registrar cuentas")

    monkeypatch.setattr(user_invites, "_authorize", is_admin)
    monkeypatch.setattr(user_invites, "_preflight", should_not_run)
    monkeypatch.setattr(user_invites, "invite_auth_user", should_not_run)
    item = InviteItem(email="admin@example.edu", full_name="Persona Admin", role="institution_admin")
    with pytest.raises(HTTPException) as error:
        asyncio.run(user_invites._invite_one(Engine(), Settings(), ACTOR, ORG, item))
    assert error.value.status_code == 403


def test_preview_csv_does_not_create_accounts(monkeypatch):
    class Conn:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

    class Engine:
        def connect(self):
            return Conn()

    async def authorize(*_):
        return ACTOR, False

    async def should_not_run(*_):
        raise AssertionError("La vista previa no debe invitar ni modificar datos")

    monkeypatch.setattr(user_invites, "_authorize", authorize)
    monkeypatch.setattr(user_invites, "invite_auth_user", should_not_run)
    payload = user_invites.PreviewRequest(csv_text="email,full_name,role\nx@site.edu,Persona Prueba,student\n")
    result = asyncio.run(user_invites.preview_import(ORG, payload, ACTOR, Engine()))
    assert result["valid"] == 1
