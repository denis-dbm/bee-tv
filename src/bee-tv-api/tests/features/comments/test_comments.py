import httpx

from app.core.db import Database
from app.features.comments.repository import NewComment, SqlCommentRepository

SHOW = "/api/v1/shows/17861"


class TestSqlCommentRepository:
    async def test_series_and_episode_comments_are_separate(self, database: Database) -> None:
        async with database.session_factory() as session:
            repository = SqlCommentRepository(session)
            series = await repository.add(NewComment("u", "Guest", "17861", None, "Series!"))
            await repository.add(NewComment("u", "Guest", "17861", "1", "Ep 1"))
            await repository.add(NewComment("u", "Guest", "17861", "1", "Ep 1 again"))
            await repository.add(NewComment("u", "Guest", "17861", "2", "Ep 2"))
            await repository.add(NewComment("u", "Guest", "42", None, "Other show"))

            assert [c.body for c in await repository.list_for("17861", None)] == ["Series!"]
            assert [c.body for c in await repository.list_for("17861", "1")] == [
                "Ep 1 again",
                "Ep 1",
            ]
            assert await repository.count_by_episode("17861") == {"1": 2, "2": 1}
            assert await repository.get(series.id) == series
            assert await repository.get(9999) is None


class TestCommentsEndpoints:
    async def test_series_comment_roundtrip(self, client: httpx.AsyncClient) -> None:
        response = await client.post(f"{SHOW}/comments", json={"body": "  Mind-blowing!  "})
        assert response.status_code == 201
        created = response.json()
        assert created["body"] == "Mind-blowing!"
        assert created["authorName"] == "Guest"
        assert created["episodeId"] is None
        assert response.headers["Location"] == f"/api/v1/comments/{created['id']}"

        assert (await client.get(response.headers["Location"])).json() == created
        assert (await client.get(f"{SHOW}/comments")).json() == {"items": [created]}

    async def test_episode_comment_roundtrip(self, client: httpx.AsyncClient) -> None:
        response = await client.post(f"{SHOW}/episodes/1/comments", json={"body": "Wow"})
        assert response.status_code == 201
        assert response.json()["episodeId"] == "1"

        items = (await client.get(f"{SHOW}/episodes/1/comments")).json()["items"]
        assert [c["body"] for c in items] == ["Wow"]
        assert (await client.get(f"{SHOW}/comments")).json() == {"items": []}

        counts = (await client.get(f"{SHOW}/episodes/comment-counts")).json()
        assert counts == {"items": [{"episodeId": "1", "count": 1}]}

    async def test_rejects_blank_or_oversized_comments(self, client: httpx.AsyncClient) -> None:
        assert (await client.post(f"{SHOW}/comments", json={"body": "   "})).status_code == 422
        assert (await client.post(f"{SHOW}/comments", json={"body": ""})).status_code == 422
        too_long = {"body": "x" * 2001}
        assert (await client.post(f"{SHOW}/comments", json=too_long)).status_code == 422

    async def test_rejects_comments_on_unknown_targets(self, client: httpx.AsyncClient) -> None:
        body = {"body": "hello"}
        assert (await client.post("/api/v1/shows/999/comments", json=body)).status_code == 404
        response = await client.post(f"{SHOW}/episodes/999/comments", json=body)
        assert response.status_code == 404

    async def test_unknown_comment(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/v1/comments/12345")
        assert response.status_code == 404
        assert response.json()["code"] == "comment_not_found"
        assert (await client.get("/api/v1/comments/0")).status_code == 422
