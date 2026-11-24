"""Regresión HTTP: los seis endpoints de borradores exigen un JWT válido.

No necesita PostgreSQL: una petición anónima no debe alcanzar el motor SQL.
Los controles por institución, instructor y concurrencia se prueban aparte.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
ORG = "11111111-1111-4111-8111-111111111111"
LESSON = "33333333-3333-4333-8333-333333333333"


@pytest.mark.parametrize("source", ["lessons", "offering-lessons"])
@pytest.mark.parametrize("method", ["GET", "POST", "PATCH"])
def test_draft_endpoint_requires_authentication(source: str, method: str) -> None:
    """No se debe exponer siquiera la existencia de un borrador anónimamente."""
    path = f"/api/v1/academic/organizations/{ORG}/{source}/{LESSON}/draft"
    payload = {
        "title": "Lección privada", "document": {"type": "doc"},
        "expected_lock_version": 1,
    }
    response = client.request(method, path, json=payload if method == "PATCH" else None)
    assert response.status_code == 401
