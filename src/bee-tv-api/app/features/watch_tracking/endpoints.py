"""Feature: mark episodes as watched / unwatched for the current user."""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.db import SessionDep
from app.core.identity import CurrentUserDep
from app.core.params import EpisodeIdPath, ShowIdPath
from app.core.schemas import ApiModel, Page
from app.features.watch_tracking.repository import (
    SqlWatchedEpisodeRepository,
    WatchedEpisode,
    WatchedEpisodeRepository,
)
from app.integrations.catalog.dependencies import CatalogDep

logger = logging.getLogger(__name__)

router = APIRouter(tags=["watch tracking"])


def get_watched_repository(session: SessionDep) -> WatchedEpisodeRepository:
    return SqlWatchedEpisodeRepository(session)


RepositoryDep = Annotated[WatchedEpisodeRepository, Depends(get_watched_repository)]


class WatchedEpisodeResponse(ApiModel):
    episode_id: str
    watched_at: datetime

    @classmethod
    def from_domain(cls, watched: WatchedEpisode) -> "WatchedEpisodeResponse":
        return cls(episode_id=watched.episode_id, watched_at=watched.watched_at)


@router.get(
    "/shows/{show_id}/watched-episodes",
    response_model=Page[WatchedEpisodeResponse],
    summary="List episodes of a series the current user has watched",
)
async def list_watched(
    show_id: ShowIdPath, user: CurrentUserDep, repository: RepositoryDep
) -> Page[WatchedEpisodeResponse]:
    watched = await repository.list_for_show(user.id, show_id)
    return Page(items=[WatchedEpisodeResponse.from_domain(item) for item in watched])


@router.put(
    "/shows/{show_id}/watched-episodes/{episode_id}",
    response_model=WatchedEpisodeResponse,
    summary="Mark an episode as watched (idempotent)",
)
async def mark_watched(
    show_id: ShowIdPath,
    episode_id: EpisodeIdPath,
    user: CurrentUserDep,
    repository: RepositoryDep,
    catalog: CatalogDep,
) -> WatchedEpisodeResponse:
    await catalog.get_episode(show_id, episode_id)
    watched = await repository.mark(user.id, show_id, episode_id)
    logger.info("User %s watched episode %s of show %s", user.id, episode_id, show_id)
    return WatchedEpisodeResponse.from_domain(watched)


@router.delete(
    "/shows/{show_id}/watched-episodes/{episode_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark an episode as not watched (idempotent)",
)
async def unmark_watched(
    show_id: ShowIdPath, episode_id: EpisodeIdPath, user: CurrentUserDep, repository: RepositoryDep
) -> Response:
    await repository.unmark(user.id, episode_id)
    logger.info("User %s unwatched episode %s of show %s", user.id, episode_id, show_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
