"""Feature: TV series details and its episodes grouped by season."""

import logging
from collections import defaultdict
from collections.abc import Iterable

from fastapi import APIRouter

from app.core.params import ShowIdPath
from app.core.schemas import ApiModel, Page
from app.integrations.catalog.dependencies import CatalogDep
from app.integrations.catalog.models import Episode, Show

logger = logging.getLogger(__name__)

router = APIRouter(tags=["show details"])


class ShowDetails(ApiModel):
    id: str
    title: str
    year: int | None
    poster_url: str | None
    summary: str
    genres: list[str]
    status: str | None
    language: str | None
    network: str | None
    rating: float | None
    premiered: str | None
    ended: str | None

    @classmethod
    def from_domain(cls, show: Show) -> "ShowDetails":
        return cls(
            id=show.id,
            title=show.title,
            year=show.year,
            poster_url=show.poster_url,
            summary=show.summary,
            genres=list(show.genres),
            status=show.status,
            language=show.language,
            network=show.network,
            rating=show.rating,
            premiered=show.premiered,
            ended=show.ended,
        )


class EpisodeItem(ApiModel):
    id: str
    season: int
    number: int | None
    title: str
    summary: str
    airdate: str | None
    runtime: int | None
    image_url: str | None
    rating: float | None

    @classmethod
    def from_domain(cls, episode: Episode) -> "EpisodeItem":
        return cls(
            id=episode.id,
            season=episode.season,
            number=episode.number,
            title=episode.title,
            summary=episode.summary,
            airdate=episode.airdate,
            runtime=episode.runtime,
            image_url=episode.image_url,
            rating=episode.rating,
        )


class Season(ApiModel):
    number: int
    episodes: list[EpisodeItem]


def group_by_season(episodes: Iterable[Episode]) -> list[Season]:
    """Seasons ascending; episodes by number with un-numbered specials last, then airdate."""
    buckets: defaultdict[int, list[Episode]] = defaultdict(list)
    for episode in episodes:
        buckets[episode.season].append(episode)

    def order(episode: Episode) -> tuple[bool, int, str]:
        return (episode.number is None, episode.number or 0, episode.airdate or "")

    return [
        Season(
            number=number,
            episodes=[EpisodeItem.from_domain(e) for e in sorted(buckets[number], key=order)],
        )
        for number in sorted(buckets)
    ]


@router.get("/shows/{show_id}", response_model=ShowDetails, summary="Get TV series details")
async def get_show(show_id: ShowIdPath, catalog: CatalogDep) -> ShowDetails:
    show = await catalog.get_show(show_id)
    logger.info("Loaded show %s (%s)", show.id, show.title)
    return ShowDetails.from_domain(show)


@router.get(
    "/shows/{show_id}/seasons",
    response_model=Page[Season],
    summary="List the TV series episodes grouped by season",
)
async def list_seasons(show_id: ShowIdPath, catalog: CatalogDep) -> Page[Season]:
    episodes = await catalog.list_episodes(show_id)
    seasons = group_by_season(episodes)
    logger.info("Show %s has %d episode(s) in %d season(s)", show_id, len(episodes), len(seasons))
    return Page(items=seasons)
