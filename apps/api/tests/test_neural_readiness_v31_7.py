"""Pruebas del alcance y del contrato agregado sin acceso a producción."""
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.main import app
from app.routers import neural_readiness

ORG = UUID('11111111-1111-4111-8111-111111111111')
PATH = f'/api/v1/neural-academic/organizations/{ORG}/readiness'
KEYS = ('enrollments', 'offerings', 'events', 'activities', 'attempts', 'progress', 'submissions', 'grades', 'skills')


def test_anonymous_readiness():
    assert TestClient(app).get(PATH).status_code == 401


@pytest.mark.parametrize('allowed,exists,status', [(False, True, 403), (True, False, 404), (True, True, 200)])
def test_scoped_readiness(monkeypatch, allowed, exists, status):
    conn = MagicMock()
    organization = MagicMock()
    organization.scalar_one_or_none.return_value = ORG if exists else None
    aggregate = MagicMock()
    aggregate.mappings.return_value.one.return_value = dict.fromkeys(KEYS, 3)
    conn.execute = AsyncMock(side_effect=[MagicMock(), organization, aggregate])
    engine = MagicMock()
    engine.begin.return_value.__aenter__.return_value = conn
    guard = AsyncMock(return_value=ORG, side_effect=None if allowed else HTTPException(403))
    monkeypatch.setattr(neural_readiness, '_require_superadmin', guard)
    monkeypatch.setitem(app.dependency_overrides, authenticated_user_id, lambda: ORG)
    monkeypatch.setitem(app.dependency_overrides, require_engine, lambda: engine)
    response = TestClient(app).get(PATH)
    assert response.status_code == status
    guard.assert_awaited_once_with(conn, ORG)
    if status == 403:
        conn.execute.assert_not_awaited()
    elif status == 404:
        assert conn.execute.await_count == 2
    else:
        assert response.json() == {'organization_id': str(ORG), 'counts': dict.fromkeys(KEYS, 3),
                                   'training_authorized': False, 'classification': 'AGGREGATE_ONLY'}
        assert conn.execute.await_args.args[1] == {'org': ORG}
        assert str(neural_readiness.COVERAGE).count('organization_id=:org') == len(KEYS)
