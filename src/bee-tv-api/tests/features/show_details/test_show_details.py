import httpx

from app.features.show_details.endpoints import group_by_season
from app.integrations.catalog.models import Episode


class TestShowDetails:
    async def test_get_show(self, client: httpx.AsyncClient) -> None:
        body = (await client.get("/api/v1/shows/17861")).json()
        assert body["title"] == "Dark"
        assert body["genres"] == ["Drama", "Science-Fiction", "Supernatural"]
        assert body["posterUrl"] == "https://img/dark.jpg"

    async def test_unknown_show_is_404(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/v1/shows/999")
        assert response.status_code == 404
        assert response.json()["code"] == "show_not_found"

    async def test_invalid_id_is_422(self, client: httpx.AsyncClient) -> None:
        assert (await client.get("/api/v1/shows/a b")).status_code == 422

    async def test_seasons(self, client: httpx.AsyncClient) -> None:
        body = (await client.get("/api/v1/shows/17861/seasons")).json()
        assert [s["number"] for s in body["items"]] == [1, 2]
        assert [e["title"] for e in body["items"][0]["episodes"]] == ["Secrets", "Lies"]

    async def test_seasons_of_unknown_show(self, client: httpx.AsyncClient) -> None:
        assert (await client.get("/api/v1/shows/999/seasons")).status_code == 404


def _episode(eid: str, season: int, number: int | None, airdate: str | None = None) -> Episode:
    return Episode(eid, "1", season, number, f"E{eid}", "", airdate=airdate)


class TestGroupBySeason:
    def test_empty(self) -> None:
        assert group_by_season([]) == []

    def test_orders_seasons_and_episodes(self) -> None:
        seasons = group_by_season(
            [
                _episode("a", 2, 2),
                _episode("b", 1, None, "2020-05-01"),
                _episode("c", 2, 1),
                _episode("d", 1, 1),
                _episode("e", 0, None),
                _episode("f", 1, None, "2020-01-01"),
            ]
        )
        assert [s.number for s in seasons] == [0, 1, 2]
        assert [e.id for e in seasons[1].episodes] == ["d", "f", "b"]
        assert [e.id for e in seasons[2].episodes] == ["c", "a"]
