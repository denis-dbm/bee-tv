"""TVMaze adapter (anti-corruption layer) for the catalog port."""

import logging
from typing import Any

import httpx

from app.core.resilience import CircuitBreaker, CircuitOpenError, RetryPolicy
from app.integrations.catalog.models import Episode, Show, ShowSummary
from app.integrations.catalog.provider import (
    CatalogProvider,
    CatalogUnavailableError,
    EpisodeNotFoundError,
    ShowNotFoundError,
)
from app.integrations.catalog.text import html_to_text

logger = logging.getLogger(__name__)

type Json = dict[str, Any]

_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})


class TransientUpstreamError(Exception):
    """An upstream failure worth retrying (timeouts, throttling, 5xx)."""


class TvMazeMapper:
    """Translates TVMaze payloads into Bee TV catalog models."""

    @staticmethod
    def _year(date: str | None) -> int | None:
        if date and len(date) >= 4 and date[:4].isdigit():  # noqa: PLR2004 - YYYY prefix
            return int(date[:4])
        return None

    @staticmethod
    def _image(payload: Json) -> str | None:
        image = payload.get("image") or {}
        url = image.get("medium") or image.get("original")
        return str(url) if url else None

    @staticmethod
    def _rating(payload: Json) -> float | None:
        value = (payload.get("rating") or {}).get("average")
        return float(value) if value is not None else None

    @classmethod
    def to_show_summary(cls, payload: Json) -> ShowSummary:
        return ShowSummary(
            id=str(payload["id"]),
            title=str(payload.get("name") or "Untitled"),
            year=cls._year(payload.get("premiered")),
            poster_url=cls._image(payload),
        )

    @classmethod
    def to_show(cls, payload: Json) -> Show:
        network = payload.get("network") or payload.get("webChannel") or {}
        return Show(
            id=str(payload["id"]),
            title=str(payload.get("name") or "Untitled"),
            year=cls._year(payload.get("premiered")),
            poster_url=cls._image(payload),
            summary=html_to_text(payload.get("summary")),
            genres=tuple(str(genre) for genre in payload.get("genres") or ()),
            status=payload.get("status"),
            language=payload.get("language"),
            network=network.get("name"),
            rating=cls._rating(payload),
            premiered=payload.get("premiered"),
            ended=payload.get("ended"),
        )

    @classmethod
    def to_episode(cls, payload: Json, show_id: str) -> Episode:
        return Episode(
            id=str(payload["id"]),
            show_id=show_id,
            season=int(payload.get("season") or 0),
            number=payload.get("number"),
            title=str(payload.get("name") or "Untitled episode"),
            summary=html_to_text(payload.get("summary")),
            airdate=payload.get("airdate") or None,
            runtime=payload.get("runtime"),
            image_url=cls._image(payload),
            rating=cls._rating(payload),
        )

    @staticmethod
    def show_id_of_episode(payload: Json) -> str | None:
        href = str(((payload.get("_links") or {}).get("show") or {}).get("href") or "")
        return href.rstrip("/").rsplit("/", 1)[-1] or None


class TvMazeCatalogProvider(CatalogProvider):
    """Talks to https://api.tvmaze.com.

    Resilience: bounded retries with backoff for transient failures, wrapped by a circuit
    breaker so a TVMaze outage fails fast instead of piling up slow requests.
    A 404 is a successful call from the breaker's perspective.
    """

    def __init__(
        self,
        client: httpx.AsyncClient,
        breaker: CircuitBreaker,
        retry_policy: RetryPolicy,
        mapper: type[TvMazeMapper] = TvMazeMapper,
    ) -> None:
        self._client = client
        self._breaker = breaker
        self._retry = retry_policy
        self._mapper = mapper

    async def search_shows(self, query: str) -> list[ShowSummary]:
        payload = await self._get_json("/search/shows", params={"q": query})
        return [self._mapper.to_show_summary(item["show"]) for item in payload or ()]

    async def get_show(self, show_id: str) -> Show:
        payload = await self._get_json(f"/shows/{self._numeric(show_id, ShowNotFoundError)}")
        if payload is None:
            raise ShowNotFoundError(f"TV series '{show_id}' does not exist")
        return self._mapper.to_show(payload)

    async def list_episodes(self, show_id: str) -> list[Episode]:
        path = f"/shows/{self._numeric(show_id, ShowNotFoundError)}/episodes"
        payload = await self._get_json(path, params={"specials": "1"})
        if payload is None:
            raise ShowNotFoundError(f"TV series '{show_id}' does not exist")
        return [self._mapper.to_episode(item, show_id) for item in payload]

    async def get_episode(self, show_id: str, episode_id: str) -> Episode:
        path = f"/episodes/{self._numeric(episode_id, EpisodeNotFoundError)}"
        payload = await self._get_json(path)
        if payload is None or self._mapper.show_id_of_episode(payload) != show_id:
            raise EpisodeNotFoundError(
                f"Episode '{episode_id}' does not exist for TV series '{show_id}'"
            )
        return self._mapper.to_episode(payload, show_id)

    @staticmethod
    def _numeric(identifier: str, not_found: type[Exception]) -> str:
        if not identifier.isdigit():
            raise not_found(f"'{identifier}' is not a valid identifier")
        return identifier

    async def _get_json(self, path: str, params: dict[str, str] | None = None) -> Any:
        async def attempt() -> Any:
            try:
                response = await self._client.get(path, params=params)
            except httpx.TransportError as exc:
                raise TransientUpstreamError(str(exc)) from exc
            if response.status_code == httpx.codes.NOT_FOUND:
                return None
            if response.status_code in _RETRYABLE_STATUS:
                raise TransientUpstreamError(f"HTTP {response.status_code}")
            response.raise_for_status()
            return response.json()

        try:
            return await self._breaker.call(lambda: self._retry.run(attempt))
        except CircuitOpenError as exc:
            logger.warning("TVMaze circuit open; failing fast for %s", path)
            raise CatalogUnavailableError() from exc
        except (TransientUpstreamError, httpx.HTTPError, ValueError) as exc:
            logger.exception("TVMaze request failed for %s", path)
            raise CatalogUnavailableError() from exc
