"""Persistence for series and episode comments."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_utc, utc_now
from app.persistence.models import CommentRecord


@dataclass(frozen=True, slots=True)
class Comment:
    id: int
    show_id: str
    episode_id: str | None
    author_name: str
    body: str
    created_at: datetime


@dataclass(frozen=True, slots=True)
class NewComment:
    user_id: str
    author_name: str
    show_id: str
    episode_id: str | None
    body: str


class CommentRepository(ABC):
    @abstractmethod
    async def add(self, comment: NewComment) -> Comment: ...

    @abstractmethod
    async def get(self, comment_id: int) -> Comment | None: ...

    @abstractmethod
    async def list_for(self, show_id: str, episode_id: str | None) -> list[Comment]:
        """Newest first. `episode_id=None` lists series-level comments only."""

    @abstractmethod
    async def count_by_episode(self, show_id: str) -> dict[str, int]: ...


class SqlCommentRepository(CommentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, comment: NewComment) -> Comment:
        record = CommentRecord(
            user_id=comment.user_id,
            author_name=comment.author_name,
            show_id=comment.show_id,
            episode_id=comment.episode_id,
            body=comment.body,
            created_at=utc_now(),
        )
        self._session.add(record)
        await self._session.commit()
        return self._to_domain(record)

    async def get(self, comment_id: int) -> Comment | None:
        record = await self._session.get(CommentRecord, comment_id)
        return self._to_domain(record) if record else None

    async def list_for(self, show_id: str, episode_id: str | None) -> list[Comment]:
        episode_filter = (
            CommentRecord.episode_id.is_(None)
            if episode_id is None
            else CommentRecord.episode_id == episode_id
        )
        rows = await self._session.scalars(
            select(CommentRecord)
            .where(CommentRecord.show_id == show_id, episode_filter)
            .order_by(CommentRecord.created_at.desc(), CommentRecord.id.desc())
        )
        return [self._to_domain(row) for row in rows]

    async def count_by_episode(self, show_id: str) -> dict[str, int]:
        rows = await self._session.execute(
            select(CommentRecord.episode_id, func.count(CommentRecord.id))
            .where(CommentRecord.show_id == show_id, CommentRecord.episode_id.is_not(None))
            .group_by(CommentRecord.episode_id)
        )
        return {str(episode_id): int(count) for episode_id, count in rows}

    @staticmethod
    def _to_domain(record: CommentRecord) -> Comment:
        return Comment(
            id=record.id,
            show_id=record.show_id,
            episode_id=record.episode_id,
            author_name=record.author_name,
            body=record.body,
            created_at=as_utc(record.created_at),
        )
