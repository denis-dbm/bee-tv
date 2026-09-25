from collections.abc import Iterator

import httpx
import pytest
import respx
from app.core.resilience import CircuitBreaker, RetryPolicy
from app.integrations.catalog.provider import (
    CatalogUnavailableError,
    EpisodeNotFoundError,
    ShowNotFoundError,
)
from app.integrations.catalog.text import html_to_text
from app.integrations.catalog.tvmaze import (
    TransientUpstreamError,
    TvMazeCatalogProvider,
    TvMazeMapper,
)

BASE = "https://tvmaze.test"

SHOW_PAYLOAD = {
    "id": 17861,
    "name": "Dark",
    "genres": ["Drama", "Science-Fiction"],
    "status": "Ended",
    "language": "German",
    "premiered": "2017-12-01",
    "ended": "2020-06-27",
    "rating": {"average": 8.2},
    "network": None,
    "webChannel": {"name": "Netflix"},
    "image": {"medium": "https://img/m.jpg", "original": "https://img/o.jpg"},
    "summary": "<p>A family saga with a <b>supernatural</b> twist &amp; more.</p>",
}

EPISODE_PAYLOAD = {
    "id": 1324842,
    "name": "Secrets",
    "season": 1,
    "number": 1,
    "airdate": "2017-12-01",
    "runtime": 52,
    "rating": {"average": 8.1},
    "image": None,
    "summary": "<p>A boy vanishes.</p>",
    "_links": {"show": {"href": "https://api.tvmaze.com/shows/17861"}},
}


@pytest.fixture
def http_mock() -> Iterator[respx.MockRouter]:
    with respx.mock as router:
        yield router


async def no_sleep(_: float) -> None:
    return None


@pytest.fixture
async def provider() -> TvMazeCatalogProvider:
    return TvMazeCatalogProvider(
        client=httpx.AsyncClient(base_url=BASE),
        breaker=CircuitBreaker("tvmaze", failure_threshold=2, reset_timeout=60),
        retry_policy=RetryPolicy(
            max_attempts=2, retry_on=(TransientUpstreamError,), sleep=no_sleep
        ),
    )


class TestHtmlToText:
    @pytest.mark.parametrize(
        ("html", "text"),
        [
            (None, ""),
            ("", ""),
            ("<p>Hello <b>world</b></p>", "Hello world"),
            ("<p>Tom &amp; Jerry</p>\n<p>again</p>", "Tom & Jerry again"),
            ("<script>x</script>plain", "xplain"),
        ],
    )
    def test_strips_markup(self, html: str | None, text: str) -> None:
        assert html_to_text(html) == text


class TestTvMazeMapper:
    def test_show(self) -> None:
        show = TvMazeMapper.to_show(SHOW_PAYLOAD)
        assert show.id == "17861"
        assert show.year == 2017
        assert show.poster_url == "https://img/m.jpg"
        assert show.summary == "A family saga with a supernatural twist & more."
        assert show.genres == ("Drama", "Science-Fiction")
        assert show.network == "Netflix"
        assert show.rating == 8.2

    def test_show_with_missing_fields(self) -> None:
        show = TvMazeMapper.to_show({"id": 1})
        assert show.title == "Untitled"
        assert show.year is None
        assert show.poster_url is None
        assert show.summary == ""
        assert show.genres == ()
        assert show.rating is None

    def test_summary_year_parsing(self) -> None:
        assert TvMazeMapper.to_show_summary({"id": 1, "premiered": "abcd"}).year is None
        assert TvMazeMapper.to_show_summary({"id": 1, "premiered": "1999-01-01"}).year == 1999

    def test_episode(self) -> None:
        episode = TvMazeMapper.to_episode(EPISODE_PAYLOAD, "17861")
        assert episode.id == "1324842"
        assert episode.show_id == "17861"
        assert (episode.season, episode.number) == (1, 1)
        assert episode.summary == "A boy vanishes."
        assert episode.image_url is None

    def test_show_id_of_episode(self) -> None:
        assert TvMazeMapper.show_id_of_episode(EPISODE_PAYLOAD) == "17861"
        assert TvMazeMapper.show_id_of_episode({}) is None


@pytest.mark.usefixtures("http_mock")
class TestTvMazeCatalogProvider:
    async def test_search(self, provider: TvMazeCatalogProvider) -> None:
        route = respx.get(f"{BASE}/search/shows", params={"q": "dark"}).respond(
            json=[{"score": 1, "show": SHOW_PAYLOAD}]
        )
        results = await provider.search_shows("dark")
        assert route.called
        assert [r.title for r in results] == ["Dark"]

    async def test_get_show(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/shows/17861").respond(json=SHOW_PAYLOAD)
        assert (await provider.get_show("17861")).title == "Dark"

    async def test_get_show_not_found(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/shows/1").respond(404)
        with pytest.raises(ShowNotFoundError):
            await provider.get_show("1")

    async def test_non_numeric_id_never_hits_partner(self, provider: TvMazeCatalogProvider) -> None:
        with pytest.raises(ShowNotFoundError):
            await provider.get_show("abc")
        with pytest.raises(EpisodeNotFoundError):
            await provider.get_episode("1", "abc")

    async def test_list_episodes_includes_specials(self, provider: TvMazeCatalogProvider) -> None:
        route = respx.get(f"{BASE}/shows/17861/episodes", params={"specials": "1"}).respond(
            json=[EPISODE_PAYLOAD]
        )
        episodes = await provider.list_episodes("17861")
        assert route.called
        assert [e.title for e in episodes] == ["Secrets"]

    async def test_list_episodes_unknown_show(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/shows/9/episodes").respond(404)
        with pytest.raises(ShowNotFoundError):
            await provider.list_episodes("9")

    async def test_get_episode(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/episodes/1324842").respond(json=EPISODE_PAYLOAD)
        assert (await provider.get_episode("17861", "1324842")).title == "Secrets"

    async def test_get_episode_of_another_show(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/episodes/1324842").respond(json=EPISODE_PAYLOAD)
        with pytest.raises(EpisodeNotFoundError):
            await provider.get_episode("999", "1324842")

    async def test_retries_transient_errors(self, provider: TvMazeCatalogProvider) -> None:
        route = respx.get(f"{BASE}/shows/17861").mock(
            side_effect=[httpx.Response(503), httpx.Response(200, json=SHOW_PAYLOAD)]
        )
        assert (await provider.get_show("17861")).title == "Dark"
        assert route.call_count == 2

    async def test_retries_transport_errors(self, provider: TvMazeCatalogProvider) -> None:
        route = respx.get(f"{BASE}/shows/17861").mock(
            side_effect=[httpx.ConnectTimeout("slow"), httpx.Response(200, json=SHOW_PAYLOAD)]
        )
        assert (await provider.get_show("17861")).title == "Dark"
        assert route.call_count == 2

    async def test_persistent_failure_is_unavailable(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/shows/17861").respond(500)
        with pytest.raises(CatalogUnavailableError):
            await provider.get_show("17861")

    async def test_non_retryable_http_error_is_unavailable(
        self, provider: TvMazeCatalogProvider
    ) -> None:
        route = respx.get(f"{BASE}/shows/17861").respond(400)
        with pytest.raises(CatalogUnavailableError):
            await provider.get_show("17861")
        assert route.call_count == 1

    async def test_malformed_json_is_unavailable(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/shows/17861").respond(200, content=b"<html>")
        with pytest.raises(CatalogUnavailableError):
            await provider.get_show("17861")

    async def test_circuit_opens_and_fails_fast(self, provider: TvMazeCatalogProvider) -> None:
        route = respx.get(f"{BASE}/shows/17861").respond(503)
        for _ in range(2):
            with pytest.raises(CatalogUnavailableError):
                await provider.get_show("17861")
        calls = route.call_count
        with pytest.raises(CatalogUnavailableError):
            await provider.get_show("17861")
        assert route.call_count == calls

    async def test_not_found_does_not_trip_circuit(self, provider: TvMazeCatalogProvider) -> None:
        respx.get(f"{BASE}/shows/1").respond(404)
        respx.get(f"{BASE}/shows/17861").respond(json=SHOW_PAYLOAD)
        for _ in range(3):
            with pytest.raises(ShowNotFoundError):
                await provider.get_show("1")
        assert (await provider.get_show("17861")).title == "Dark"
