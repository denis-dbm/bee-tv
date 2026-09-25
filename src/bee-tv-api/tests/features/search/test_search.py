import httpx

from tests.fakes import FakeCatalogProvider


class TestSearch:
    async def test_returns_results(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/v1/shows", params={"q": "dar"})
        assert response.status_code == 200
        assert response.json() == {
            "items": [
                {"id": "17861", "title": "Dark", "year": 2017, "posterUrl": "https://img/dark.jpg"}
            ]
        }

    async def test_blank_query_short_circuits(
        self, client: httpx.AsyncClient, catalog: FakeCatalogProvider
    ) -> None:
        response = await client.get("/api/v1/shows", params={"q": "   "})
        assert response.json() == {"items": []}
        assert catalog.calls == []

    async def test_requires_query(self, client: httpx.AsyncClient) -> None:
        assert (await client.get("/api/v1/shows")).status_code == 422
        assert (await client.get("/api/v1/shows", params={"q": "x" * 101})).status_code == 422

    async def test_partner_outage_is_503(
        self, client: httpx.AsyncClient, catalog: FakeCatalogProvider
    ) -> None:
        catalog.unavailable = True
        response = await client.get("/api/v1/shows", params={"q": "dark"})
        assert response.status_code == 503
        assert response.json()["code"] == "catalog_unavailable"
