"""Feature: Bee Review, AI-powered insights for a TV series or an episode."""

import asyncio
import logging
from datetime import datetime
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Query, Request

from app.core.config import Settings, get_settings
from app.core.db import SessionDep, utc_now
from app.core.params import EpisodeIdPath, ShowIdPath
from app.core.schemas import ApiModel
from app.features.bee_review.insights import (
    Insight,
    InsightGenerator,
    InsightSource,
    InsightSubject,
    SubjectKind,
)
from app.features.bee_review.opinions import OpinionSource, SqlOpinionSource
from app.integrations.catalog.dependencies import CatalogDep

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bee review"])


def get_insight_generator(request: Request) -> InsightGenerator:
    return cast(InsightGenerator, request.app.state.insight_generator)


def get_opinion_source(session: SessionDep) -> OpinionSource:
    return SqlOpinionSource(session)


GeneratorDep = Annotated[InsightGenerator, Depends(get_insight_generator)]
OpinionsDep = Annotated[OpinionSource, Depends(get_opinion_source)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
IncludeCommentsQuery = Annotated[
    bool, Query(alias="includeComments", description="Consider viewer comments")
]


class BeeReviewResponse(ApiModel):
    subject: SubjectKind
    text: str
    source: InsightSource
    generator: str
    comments_considered: int
    generated_at: datetime

    @classmethod
    def from_domain(cls, subject: InsightSubject, insight: Insight) -> "BeeReviewResponse":
        return cls(
            subject=subject.kind,
            text=insight.text,
            source=insight.source,
            generator=insight.generator,
            comments_considered=len(subject.comments),
            generated_at=utc_now(),
        )


@router.get(
    "/shows/{show_id}/review",
    response_model=BeeReviewResponse,
    summary="Generate a Bee Review for a TV series",
)
async def review_show(
    show_id: ShowIdPath,
    catalog: CatalogDep,
    generator: GeneratorDep,
    opinions: OpinionsDep,
    settings: SettingsDep,
    include_comments: IncludeCommentsQuery = False,
) -> BeeReviewResponse:
    show = await catalog.get_show(show_id)
    comments = (
        await opinions.recent(show_id, None, settings.insight_max_comments)
        if include_comments
        else ()
    )
    subject = InsightSubject(
        kind=SubjectKind.SERIES,
        title=show.title,
        summary=show.summary,
        genres=show.genres,
        comments=comments,
    )
    insight = await generator.generate(subject)
    logger.info(
        "Bee Review for show %s by %s (%s, %d comment(s))",
        show_id,
        insight.generator,
        insight.source,
        len(comments),
    )
    return BeeReviewResponse.from_domain(subject, insight)


@router.get(
    "/shows/{show_id}/episodes/{episode_id}/review",
    response_model=BeeReviewResponse,
    summary="Generate a Bee Review for an episode",
)
async def review_episode(
    show_id: ShowIdPath,
    episode_id: EpisodeIdPath,
    catalog: CatalogDep,
    generator: GeneratorDep,
    opinions: OpinionsDep,
    settings: SettingsDep,
    include_comments: IncludeCommentsQuery = False,
) -> BeeReviewResponse:
    # gather (not TaskGroup) so domain errors propagate unwrapped to the global handlers.
    show, episode = await asyncio.gather(
        catalog.get_show(show_id), catalog.get_episode(show_id, episode_id)
    )
    comments = (
        await opinions.recent(show_id, episode_id, settings.insight_max_comments)
        if include_comments
        else ()
    )
    subject = InsightSubject(
        kind=SubjectKind.EPISODE,
        title=episode.title,
        summary=episode.summary,
        genres=show.genres,
        series_title=show.title,
        season=episode.season,
        number=episode.number,
        comments=comments,
    )
    insight = await generator.generate(subject)
    logger.info(
        "Bee Review for episode %s of show %s by %s (%s, %d comment(s))",
        episode_id,
        show_id,
        insight.generator,
        insight.source,
        len(comments),
    )
    return BeeReviewResponse.from_domain(subject, insight)
