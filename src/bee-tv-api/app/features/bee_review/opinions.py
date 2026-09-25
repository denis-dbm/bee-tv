"""Read-side access to viewer opinions used to enrich insights.

This slice owns its own query over the shared `comments` table instead of importing the
comments slice, keeping slices independent.
"""

from abc import ABC, abstractmethod

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.persistence.models import CommentRecord


class OpinionSource(ABC):
    @abstractmethod
    async def recent(self, show_id: str, episode_id: str | None, limit: int) -> tuple[str, ...]:
        """Most recent comment bodies. `episode_id=None` means series-level comments."""


class SqlOpinionSource(OpinionSource):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def recent(self, show_id: str, episode_id: str | None, limit: int) -> tuple[str, ...]:
        episode_filter = (
            CommentRecord.episode_id.is_(None)
            if episode_id is None
            else CommentRecord.episode_id == episode_id
        )
        rows = await self._session.scalars(
            select(CommentRecord.body)
            .where(CommentRecord.show_id == show_id, episode_filter)
            .order_by(CommentRecord.created_at.desc(), CommentRecord.id.desc())
            .limit(limit)
        )
        return tuple(rows)
