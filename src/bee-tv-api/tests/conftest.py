from collections.abc import AsyncIterator

import httpx
import pytest
from app.core.config import Settings
from app.core.db import Base, Database
from app.main import create_app
from app.persistence import models  # noqa: F401 - registers tables
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from tests.fakes import FakeCatalogProvider, FakeInsightGenerator

SQLITE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None, database_url=SQLITE_URL, insight_api_token=None, log_level="WARNING"
    )


@pytest.fixture
async def database() -> AsyncIterator[Database]:
    engine = create_async_engine(
        SQLITE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    db = Database(engine)
    yield db
    await db.dispose()


@pytest.fixture
def catalog() -> FakeCatalogProvider:
    return FakeCatalogProvider()


@pytest.fixture
def insight_generator() -> FakeInsightGenerator:
    return FakeInsightGenerator()


@pytest.fixture
def app(
    settings: Settings,
    database: Database,
    catalog: FakeCatalogProvider,
    insight_generator: FakeInsightGenerator,
) -> FastAPI:
    application = create_app(settings)
    application.state.database = database
    application.state.catalog = catalog
    application.state.insight_generator = insight_generator
    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
