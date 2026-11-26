"""Regresión estructural del alcance de los agregados del mapa institucional."""
from app.routers.organizations import ORGANIZATION_LIST_SQL


def test_counts_are_scoped_and_permission_guarded():
    sql = str(ORGANIZATION_LIST_SQL)
    assert sql.count('CASE WHEN access.can_view_counts THEN') == 2
    assert 'e.organization_id = o.id' in sql
    assert 's.organization_id = o.id' in sql
    assert "r.code IN ('institution_admin', 'coordinator')" in sql
    assert "r.code = 'superadmin' AND r.scope = 'global'" in sql
    assert "m.organization_id = o.id AND m.status = 'active'" in sql
    assert 'END AS enrollment_count' in sql
    assert 'END AS student_count' in sql
    assert 'COALESCE' not in sql
