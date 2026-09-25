import httpx
import pytest
from app.core.config import Settings
from app.integrations.catalog.cached import CachedCatalogProvider
from app.integrations.catalog.dependencies import build_catalog_http_client, build_catalog_provider
from app.integrations.catalog.provider import CatalogUnavailableError, ShowNotFoundError

from tests.fakes import FakeCatalogProvider


class Timer:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def inner() -> FakeCatalogProvider:
    return FakeCatalogProvider()


@pytest.fixture
def timer() -> Timer:
    return Timer()


@pytest.fixture
def cached(inner: FakeCatalogProvider, timer: Timer) -> CachedCatalogProvider:
    return CachedCatalogProvider(inner, ttl_seconds=60, timer=timer)


class TestCachedCatalogProvider:
    async def test_caches_every_read(
        self, cached: CachedCatalogProvider, inner: FakeCatalogProvider
    ) -> None:
        for _ in range(2):
            await cached.search_shows("dark")
            await cached.get_show("17861")
            await cached.list_episodes("17861")
            await cached.get_episode("17861", "1")
        assert inner.calls == ["search:dark", "show:17861", "episodes:17861", "episode:17861:1"]

    async def test_search_key_is_normalized(
        self, cached: CachedCatalogProvider, inner: FakeCatalogProvider
    ) -> None:
        await cached.search_shows("Dark")
        await cached.search_shows("  dark ")
        assert len(inner.calls) == 1

    async def test_returns_fresh_lists(self, cached: CachedCatalogProvider) -> None:
        first = await cached.list_episodes("17861")
        first.clear()
        assert len(await cached.list_episodes("17861")) == 3

    async def test_entries_expire(
        self, cached: CachedCatalogProvider, inner: FakeCatalogProvider, timer: Timer
    ) -> None:
        await cached.get_show("17861")
        timer.now = 61
        await cached.get_show("17861")
        assert inner.calls == ["show:17861", "show:17861"]

    async def test_errors_are_not_cached(
        self, cached: CachedCatalogProvider, inner: FakeCatalogProvider
    ) -> None:
        inner.unavailable = True
        with pytest.raises(CatalogUnavailableError):
            await cached.get_show("17861")
        inner.unavailable = False
        assert (await cached.get_show("17861")).title == "Dark"
        with pytest.raises(ShowNotFoundError):
            await cached.get_show("nope")


async def test_composition_root_wraps_tvmaze_with_cache() -> None:
    settings = Settings(catalog_base_url="https://tvmaze.test")
    client = build_catalog_http_client(settings)
    try:
        assert isinstance(client, httpx.AsyncClient)
        assert str(client.base_url) == "https://tvmaze.test"
        assert isinstance(build_catalog_provider(settings, client), CachedCatalogProvider)
    finally:
        await client.aclose()
