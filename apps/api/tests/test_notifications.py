"""Contrato HTTP y alcance de la bandeja; conexiones simuladas."""
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app

ID = UUID('11111111-1111-4111-8111-111111111111')
PATH = '/api/v1/notifications'


@pytest.mark.parametrize('method,path', [('GET', PATH), ('POST', PATH+'/refresh'), ('PATCH', PATH+'/read-all'),
                                         ('PATCH', f'{PATH}/{ID}/read')])
def test_requires_auth(method, path):
    assert TestClient(app).request(method, path).status_code == 401


@pytest.fixture
def conn(monkeypatch):
    connection = MagicMock()
    connection.execute = AsyncMock(return_value=MagicMock())
    engine = MagicMock()
    engine.connect.return_value.__aenter__.return_value = connection
    engine.begin.return_value.__aenter__.return_value = connection
    monkeypatch.setitem(app.dependency_overrides, authenticated_user_id, lambda: ID)
    monkeypatch.setitem(app.dependency_overrides, require_engine, lambda: engine)
    return connection


def test_list_scopes_to_current_recipient(conn):
    conn.execute.return_value.scalar_one.return_value = 0
    conn.execute.return_value.mappings.return_value.all.return_value = []
    assert TestClient(app).get(PATH).json() == {'unread': 0, 'items': []}
    for call in conn.execute.await_args_list:
        sql, params = call.args
        assert params == {'auth_id': ID}
        for condition in ('u.auth_user_id=:auth_id', 'm.user_id=u.id', "m.status='active'",
                          "c.status='published'", 'r.organization_id=n.organization_id'):
            assert condition in str(sql)


@pytest.mark.parametrize('found,expected', [(None, 404), (ID, 200)])
def test_read_checks_recipient_and_resource(conn, found, expected):
    conn.execute.return_value.scalar_one_or_none.return_value = found
    assert TestClient(app).patch(f'{PATH}/{ID}/read').status_code == expected
    sql, params = conn.execute.await_args.args
    assert 'id=:id AND id IN' in str(sql)
    assert 'u.auth_user_id=:auth_id' in str(sql)
    assert params == {'auth_id': ID, 'id': ID}


def test_read_all_scoped(conn):
    assert TestClient(app).patch(PATH+'/read-all').json() == {'ok': True}
    sql, params = conn.execute.await_args.args
    assert 'read_at IS NULL AND id IN' in str(sql)
    assert 'u.auth_user_id=:auth_id' in str(sql)
    assert params == {'auth_id': ID}


def test_academic_notifications_revalidate_current_recipient(conn):
    conn.execute.return_value.scalar_one.return_value = 0
    conn.execute.return_value.mappings.return_value.all.return_value = []
    assert TestClient(app).get(PATH).status_code == 200
    sql = str(conn.execute.await_args.args[0])
    for condition in ('v.organization_id=n.organization_id', 'v.resource_id=n.resource_id',
                      'v.event_type=n.event_type', 'v.resource_type=n.resource_type',
                      'v.recipient_id=n.recipient_id', 'u.auth_user_id=:auth_id'):
        assert condition in sql


def test_refresh_materializes_only_authenticated_reminders(conn):
    conn.execute.return_value.scalar_one.return_value = 0
    conn.execute.return_value.mappings.return_value.all.return_value = []
    assert TestClient(app).post(PATH+'/refresh').json() == {'unread': 0, 'items': []}
    assert conn.execute.await_count == 3
    sql, params = conn.execute.await_args_list[0].args
    assert 'INSERT INTO app.notifications' in str(sql)
    assert 'app.notification_reminder_events' in str(sql)
    assert 'u.auth_user_id=:auth_id' in str(sql)
    assert 'ON CONFLICT (recipient_id,deduplication_key) DO NOTHING' in str(sql)
    assert params == {'auth_id': ID}
    for call in conn.execute.await_args_list[1:]:
        assert 'app.notification_management_events' in str(call.args[0])
        assert 'v.recipient_id=n.recipient_id' in str(call.args[0])
