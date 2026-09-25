"""Composition and FastAPI wiring for the catalog integration."""

from typing import Annotated, cast

import httpx
from fastapi import Depends, Request

from app.core.config import Settings
from app.core.resilience import CircuitBreaker, RetryPolicy
from app.integrations.catalog.cached import CachedCatalogProvider
from app.integrations.catalog.provider import CatalogProvider
from app.integrations.catalog.tvmaze import TransientUpstreamError, TvMazeCatalogProvider


def build_catalog_provider(settings: Settings, client: httpx.AsyncClient) -> CatalogProvider:
    """Composition root for the catalog. Swapping partners means swapping this factory."""
    tvmaze = TvMazeCatalogProvider(
        client=client,
        breaker=CircuitBreaker(
            "tvmaze",
            failure_threshold=settings.circuit_breaker_failure_threshold,
            reset_timeout=settings.circuit_breaker_reset_seconds,
        ),
        retry_policy=RetryPolicy(
            max_attempts=settings.catalog_max_attempts,
            retry_on=(TransientUpstreamError,),
        ),
    )
    return CachedCatalogProvider(
        tvmaze,
        ttl_seconds=settings.catalog_cache_ttl_seconds,
        max_entries=settings.catalog_cache_max_entries,
    )


def build_catalog_http_client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.catalog_base_url,
        timeout=settings.catalog_timeout_seconds,
        headers={"User-Agent": "BeeTV/0.1 (+https://github.com/denis-dbm/bee-tv)"},
    )


def get_catalog(request: Request) -> CatalogProvider:
    return cast(CatalogProvider, request.app.state.catalog)


CatalogDep = Annotated[CatalogProvider, Depends(get_catalog)]
