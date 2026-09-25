import httpx
import pytest

from app.core.db import Database
from app.features.watch_tracking.repository import SqlWatchedEpisodeRepository
from tests.fakes import FakeCatalogProvider

BASE = "/api/v1/shows/17861/watched-episodes"


class TestSqlWatchedEpisodeRepository:
    async def test_mark_is_idempotent(self, database: Database) -> None:
        async with database.session_factory() as session:
            repository = SqlWatchedEpisodeRepository(session)
            first = await repository.mark("u1", "17861", "1")
            second = await repository.mark("u1", "17861", "1")
            assert first.watched_at == second.watched_at
            assert first.watched_at.tzinfo is not None
            assert [w.episode_id for w in await repository.list_for_show("u1", "17861")] == ["1"]

    async def test_scoped_per_user_and_show(self, database: Database) -> None:
        async with database.session_factory() as session:
            repository = SqlWatchedEpisodeRepository(session)
            await repository.mark("u1", "17861", "1")
            await repository.mark("u2", "17861", "2")
            await repository.mark("u1", "42", "9")
            assert [w.episode_id for w in await repository.list_for_show("u1", "17861")] == ["1"]

    async def test_unmark(self, database: Database) -> None:
        async with database.session_factory() as session:
            repository = SqlWatchedEpisodeRepository(session)
            await repository.mark("u1", "17861", "1")
            await repository.unmark("u1", "1")
            await repository.unmark("u1", "1")
            assert await repository.list_for_show("u1", "17861") == []


class TestWatchTrackingEndpoints:
    async def test_mark_list_unmark(self, client: httpx.AsyncClient) -> None:
        assert (await client.get(BASE)).json() == {"items": []}

        response = await client.put(f"{BASE}/1")
        assert response.status_code == 200
        assert response.json()["episodeId"] == "1"
        assert (await client.put(f"{BASE}/1")).status_code == 200

        items = (await client.get(BASE)).json()["items"]
        assert [i["episodeId"] for i in items] == ["1"]

        assert (await client.delete(f"{BASE}/1")).status_code == 204
        assert (await client.delete(f"{BASE}/1")).status_code == 204
        assert (await client.get(BASE)).json() == {"items": []}

    @pytest.mark.parametrize("path", ["/api/v1/shows/17861/watched-episodes/999"])
    async def test_cannot_mark_unknown_episode(self, client: httpx.AsyncClient, path: str) -> None:
        response = await client.put(path)
        assert response.status_code == 404
        assert response.json()["code"] == "episode_not_found"

    async def test_catalog_outage_blocks_marking(
        self, client: httpx.AsyncClient, catalog: FakeCatalogProvider
    ) -> None:
        catalog.unavailable = True
        assert (await client.put(f"{BASE}/1")).status_code == 503


class TestConcurrentMark:
    async def test_lost_race_returns_winner(
        self, database: Database, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        async with database.session_factory() as winner_session:
            await SqlWatchedEpisodeRepository(winner_session).mark("u1", "17861", "1")

        async with database.session_factory() as session:
            original_get = session.get
            calls = 0

            async def stale_first_read(*args: object, **kwargs: object) -> object:
                nonlocal calls
                calls += 1
                return None if calls == 1 else await original_get(*args, **kwargs)  # type: ignore[arg-type]

            monkeypatch.setattr(session, "get", stale_first_read)
            watched = await SqlWatchedEpisodeRepository(session).mark("u1", "17861", "1")
            assert watched.episode_id == "1"
            assert calls == 2
