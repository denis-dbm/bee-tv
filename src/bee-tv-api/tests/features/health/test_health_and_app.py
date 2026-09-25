import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import Settings
from app.core.db import Database
from app.features.bee_review.insights import InsightGenerator
from app.integrations.catalog.provider import CatalogProvider
from app.main import create_app


class TestHealth:
    async def test_ok(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "database": "up"}

    async def test_degraded_when_database_is_down(
        self, app: FastAPI, client: httpx.AsyncClient
    ) -> None:
        app.state.database = Database(
            create_async_engine("sqlite+aiosqlite:////nonexistent/dir/db.sqlite")
        )
        response = await client.get("/api/health")
        assert response.status_code == 503
        assert response.json() == {"status": "degraded", "database": "down"}


class TestApplicationFactory:
    def test_registers_all_feature_routes(self, settings: Settings) -> None:
        paths = set(create_app(settings).openapi()["paths"])
        assert {
            "/api/health",
            "/api/v1/shows",
            "/api/v1/shows/{show_id}",
            "/api/v1/shows/{show_id}/seasons",
            "/api/v1/shows/{show_id}/watched-episodes",
            "/api/v1/shows/{show_id}/watched-episodes/{episode_id}",
            "/api/v1/shows/{show_id}/comments",
            "/api/v1/shows/{show_id}/episodes/comment-counts",
            "/api/v1/shows/{show_id}/episodes/{episode_id}/comments",
            "/api/v1/comments/{comment_id}",
            "/api/v1/shows/{show_id}/review",
            "/api/v1/shows/{show_id}/episodes/{episode_id}/review",
        } <= paths

    @pytest.mark.parametrize("token", [None, "hf_test"])
    async def test_lifespan_wires_ports(self, token: str | None) -> None:
        settings = Settings(database_url="sqlite+aiosqlite:///:memory:", insight_api_token=token)
        app = create_app(settings)
        async with app.router.lifespan_context(app):
            assert isinstance(app.state.database, Database)
            assert isinstance(app.state.catalog, CatalogProvider)
            assert isinstance(app.state.insight_generator, InsightGenerator)
