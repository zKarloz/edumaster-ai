#!/usr/bin/env bash
# Ejecuta la migración 009 únicamente sobre una base VACÍA Y DESECHABLE.
# Nunca se conecta automáticamente a Supabase ni sobrescribe datos de producción.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${EDUMASTER_TEST_DB_URL:?Define EDUMASTER_TEST_DB_URL para una base PostgreSQL de prueba desechable}"
if [[ "${EDUMASTER_SQL_TEST_CONFIRM:-}" != 'ONLY_DISPOSABLE_DB' ]]; then
  echo 'ERROR: establece EDUMASTER_SQL_TEST_CONFIRM=ONLY_DISPOSABLE_DB tras verificar que es una BD de ensayo.' >&2
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo 'ERROR: falta psql en PATH; usa PostgreSQL local o una instancia de ensayo con psql.' >&2
  exit 2
fi
APP_PRESENT="$(psql "$EDUMASTER_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM pg_namespace WHERE nspname='app';")"
if [[ "$APP_PRESENT" != '0' ]]; then
  echo 'ERROR: la base ya contiene el esquema app; no se modificó nada.' >&2
  exit 2
fi
psql "$EDUMASTER_TEST_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f "$ROOT/tools/verificacion/fixture_009.sql" \
  -f "$ROOT/database/migrations/009_lesson_revisions.sql" \
  -f "$ROOT/tools/verificacion/aserciones_009.sql"
echo 'Prueba de 009 superada en base de datos desechable.'
