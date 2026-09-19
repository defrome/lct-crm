#!/usr/bin/env bash
# Container entrypoint: wait for a query-ready PostgreSQL, apply migrations, then start.
#
# Migrations run here rather than at application startup so that scaling the
# service to several replicas does not race: `alembic upgrade` takes a lock,
# and a replica that loses the race simply finds the schema already current.
set -euo pipefail

host="${POSTGRES_HOST:-db}"
port="${POSTGRES_PORT:-5432}"

echo "waiting for postgres at ${host}:${port}..."
postgres_ready=0
for _ in $(seq 1 60); do
    if python - <<'PY' >/dev/null 2>&1
import asyncio
import os
import sys

import asyncpg


async def is_ready() -> bool:
    connection = None
    try:
        connection = await asyncpg.connect(
            host=os.getenv("POSTGRES_HOST", "db"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            user=os.getenv("POSTGRES_USER", "crm"),
            password=os.getenv("POSTGRES_PASSWORD", "crm"),
            database=os.getenv("POSTGRES_DB", "crm"),
            timeout=1,
        )
        await connection.execute("SELECT 1")
        return True
    except (OSError, asyncio.TimeoutError, asyncpg.PostgresError):
        return False
    finally:
        if connection is not None:
            await connection.close()


sys.exit(0 if asyncio.run(is_ready()) else 1)
PY
    then
        echo "postgres is accepting queries"
        postgres_ready=1
        break
    fi
    sleep 1
done

if [ "${postgres_ready}" -ne 1 ]; then
    echo "postgres did not become ready within 60 seconds" >&2
    exit 1
fi

echo "applying migrations..."
alembic upgrade head

if [ "${SEED_ON_START:-false}" = "true" ]; then
    echo "seeding demo data..."
    python -m scripts.seed
fi

exec "$@"
