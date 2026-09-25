"""Schema deployment: wait for the database, then apply Alembic migrations.

Run as `python -m app.migrate` (the container entrypoint does it before starting the API).
Waiting here is belt-and-braces on top of the Compose healthcheck: it also covers
orchestrators/runtimes that do not honour `depends_on` conditions.
"""

import asyncio
import logging
import sys
from collections.abc import Awaitable, Callable
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.exc import DBAPIError

from app.core.config import Settings, get_settings
from app.core.db import Database
from app.core.logging import configure_logging

logger = logging.getLogger("bee_tv.migrate")

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"

type Sleeper = Callable[[float], Awaitable[None]]


class DatabaseUnavailableError(RuntimeError):
    """The database never became reachable within the configured attempts."""


async def wait_for_database(
    database: Database,
    max_attempts: int,
    retry_seconds: float,
    sleep: Sleeper = asyncio.sleep,
) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            await database.ping()
        except (DBAPIError, OSError) as exc:
            if attempt >= max_attempts:
                raise DatabaseUnavailableError(
                    f"Database unreachable after {max_attempts} attempts"
                ) from exc
            logger.warning(
                "Database not ready (attempt %d/%d): %s", attempt, max_attempts, type(exc).__name__
            )
            await sleep(retry_seconds)
        else:
            logger.info("Database reachable")
            return


def upgrade_schema(
    database_url: str, revision: str = "head", config_path: Path = ALEMBIC_INI
) -> None:
    config = Config(str(config_path))
    # ConfigParser interpolation: a literal '%' (e.g. URL-encoded passwords) must be doubled.
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.upgrade(config, revision)
    logger.info("Database schema is at revision '%s'", revision)


async def _wait(settings: Settings) -> None:
    database = Database.from_url(settings.database_url)
    try:
        await wait_for_database(
            database, settings.migrate_max_attempts, settings.migrate_retry_seconds
        )
    finally:
        await database.dispose()


def main(settings: Settings | None = None) -> int:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    try:
        asyncio.run(_wait(settings))
        upgrade_schema(settings.database_url)
    except Exception:
        logger.exception("Schema deployment failed")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
