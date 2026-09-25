"""Application factory and composition root."""

import logging
from collections.abc import AsyncIterator
from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI

from app.core.config import Settings, get_settings
from app.core.db import Database
from app.core.errors import register_exception_handlers
from app.core.logging import access_log_middleware, configure_logging
from app.features.bee_review.composition import build_insight_generator, build_insight_http_client
from app.features.bee_review.endpoints import router as bee_review_router
from app.features.comments.endpoints import router as comments_router
from app.features.health.endpoints import router as health_router
from app.features.search.endpoints import router as search_router
from app.features.show_details.endpoints import router as show_details_router
from app.features.watch_tracking.endpoints import router as watch_tracking_router
from app.integrations.catalog.dependencies import build_catalog_http_client, build_catalog_provider

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with AsyncExitStack() as stack:
            database = Database.from_url(settings.database_url)
            stack.push_async_callback(database.dispose)
            catalog_client = await stack.enter_async_context(build_catalog_http_client(settings))
            insight_client = build_insight_http_client(settings)
            if insight_client is not None:
                await stack.enter_async_context(insight_client)

            app.state.database = database
            app.state.catalog = build_catalog_provider(settings, catalog_client)
            app.state.insight_generator = build_insight_generator(settings, insight_client)
            logger.info("%s started", settings.app_name)
            yield
            logger.info("%s shutting down", settings.app_name)

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.middleware("http")(access_log_middleware)
    register_exception_handlers(app)

    app.include_router(health_router, prefix="/api")
    for router in (
        search_router,
        show_details_router,
        watch_tracking_router,
        comments_router,
        bee_review_router,
    ):
        app.include_router(router, prefix=API_PREFIX)
    return app
