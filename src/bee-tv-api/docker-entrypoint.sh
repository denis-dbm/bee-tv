#!/bin/sh
# Deploys the database schema (Alembic migrations) before starting the API.
# Set BEE_SKIP_MIGRATIONS=true when migrations run as a separate release job.
set -eu

if [ "${BEE_SKIP_MIGRATIONS:-false}" != "true" ]; then
    python -m app.migrate
fi

exec "$@"
