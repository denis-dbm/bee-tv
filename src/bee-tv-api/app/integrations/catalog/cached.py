"""Caching decorator for any `CatalogProvider`."""

import time
from collections.abc import Awaitable, Callable, Hashable
from typing import Any

from cachetools import TTLCache

from app.integrations.catalog.models import Episode, Show, ShowSummary
from app.integrations.catalog.provider import CatalogProvider


class CachedCatalogProvider(CatalogProvider):
    """Decorator pattern: adds TTL caching without the wrapped provider knowing.

    Catalog data changes slowly and partners rate-limit (TVMaze: ~20 calls / 10s),
    so a short-lived in-process cache is a cheap, high-value win for the MVP.
    Only successful results are cached; errors always propagate.
    """

    def __init__(
        self,
        inner: CatalogProvider,
        ttl_seconds: float = 300.0,
        max_entries: int = 1024,
        timer: Callable[[], float] = time.monotonic,
    ) -> None:
        self._inner = inner
        self._cache: TTLCache[Hashable, Any] = TTLCache(
            maxsize=max_entries, ttl=ttl_seconds, timer=timer
        )

    async def search_shows(self, query: str) -> list[ShowSummary]:
        normalized = " ".join(query.lower().split())
        return list(
            await self._cached(("search", normalized), lambda: self._inner.search_shows(query))
        )

    async def get_show(self, show_id: str) -> Show:
        result: Show = await self._cached(("show", show_id), lambda: self._inner.get_show(show_id))
        return result

    async def list_episodes(self, show_id: str) -> list[Episode]:
        return list(
            await self._cached(("episodes", show_id), lambda: self._inner.list_episodes(show_id))
        )

    async def get_episode(self, show_id: str, episode_id: str) -> Episode:
        result: Episode = await self._cached(
            ("episode", show_id, episode_id),
            lambda: self._inner.get_episode(show_id, episode_id),
        )
        return result

    async def _cached(self, key: Hashable, load: Callable[[], Awaitable[Any]]) -> Any:
        try:
            return self._cache[key]
        except KeyError:
            pass
        value = await load()
        if isinstance(value, list):
            value = tuple(value)
        self._cache[key] = value
        return value
