"""Feature: TV series search."""

import logging
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.schemas import ApiModel, Page
from app.integrations.catalog.dependencies import CatalogDep
from app.integrations.catalog.models import ShowSummary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])


class ShowSearchResult(ApiModel):
    id: str
    title: str
    year: int | None
    poster_url: str | None

    @classmethod
    def from_domain(cls, show: ShowSummary) -> "ShowSearchResult":
        return cls(id=show.id, title=show.title, year=show.year, poster_url=show.poster_url)


@router.get("/shows", response_model=Page[ShowSearchResult], summary="Search TV series")
async def search_shows(
    catalog: CatalogDep,
    q: Annotated[str, Query(min_length=1, max_length=100, description="Free-text query")],
) -> Page[ShowSearchResult]:
    query = q.strip()
    if not query:
        return Page(items=[])
    shows = await catalog.search_shows(query)
    logger.info("Search q=%r returned %d result(s)", query, len(shows))
    return Page(items=[ShowSearchResult.from_domain(show) for show in shows])
