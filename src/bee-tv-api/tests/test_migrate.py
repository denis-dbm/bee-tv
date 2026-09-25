from pathlib import Path

import pytest
from app.core.config import Settings
from app.migrate import DatabaseUnavailableError, main, upgrade_schema, wait_for_database
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import OperationalError


class FlakyDatabase:
    def __init__(self, failures: int, error: Exception) -> None:
        self.failures = failures
        self.error = error
        self.pings = 0

    async def ping(self) -> None:
        self.pings += 1
        if self.pings <= self.failures:
            raise self.error


async def no_sleep(_: float) -> None:
    return None


class TestWaitForDatabase:
    async def test_returns_once_reachable(self) -> None:
        database = FlakyDatabase(failures=2, error=OSError("refused"))
        await wait_for_database(database, max_attempts=5, retry_seconds=0, sleep=no_sleep)  # type: ignore[arg-type]
        assert database.pings == 3

    async def test_retries_driver_errors(self) -> None:
        error = OperationalError("SELECT 1", {}, Exception("Can't connect"))
        database = FlakyDatabase(failures=1, error=error)
        await wait_for_database(database, max_attempts=2, retry_seconds=0, sleep=no_sleep)  # type: ignore[arg-type]
        assert database.pings == 2

    async def test_gives_up(self) -> None:
        database = FlakyDatabase(failures=10, error=OSError("refused"))
        with pytest.raises(DatabaseUnavailableError):
            await wait_for_database(database, max_attempts=3, retry_seconds=0, sleep=no_sleep)  # type: ignore[arg-type]
        assert database.pings == 3


def _tables(path: Path) -> set[str]:
    engine = create_engine(f"sqlite:///{path}")
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


class TestSchemaDeployment:
    def test_upgrade_creates_schema_and_is_idempotent(self, tmp_path: Path) -> None:
        db_file = tmp_path / "bee.db"
        upgrade_schema(f"sqlite+aiosqlite:///{db_file}")
        upgrade_schema(f"sqlite+aiosqlite:///{db_file}")
        assert {"alembic_version", "comments", "watched_episodes"} <= _tables(db_file)

    def test_main_waits_then_migrates(self, tmp_path: Path) -> None:
        db_file = tmp_path / "main.db"
        settings = Settings(_env_file=None, database_url=f"sqlite+aiosqlite:///{db_file}")
        assert main(settings) == 0
        assert "comments" in _tables(db_file)

    def test_main_reports_failure(self, tmp_path: Path) -> None:
        settings = Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path}/missing/dir/x.db",
            migrate_max_attempts=1,
        )
        assert main(settings) == 1


@pytest.mark.parametrize("blank", ["", "   "])
def test_blank_ai_token_means_not_configured(blank: str) -> None:
    assert Settings(_env_file=None, insight_api_token=blank).insight_api_token is None
