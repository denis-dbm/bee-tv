"""Persistence for watched episodes."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_utc, utc_now
from app.persistence.models import WatchedEpisodeRecord


@dataclass(frozen=True, slots=True)
class WatchedEpisode:
    show_id: str
    episode_id: str
    watched_at: datetime


class WatchedEpisodeRepository(ABC):
    @abstractmethod
    async def list_for_show(self, user_id: str, show_id: str) -> list[WatchedEpisode]: ...

    @abstractmethod
    async def mark(self, user_id: str, show_id: str, episode_id: str) -> WatchedEpisode:
        """Idempotent: marking twice keeps the original timestamp."""

    @abstractmethod
    async def unmark(self, user_id: str, episode_id: str) -> None:
        """Idempotent: unmarking an unwatched episode is a no-op."""


class SqlWatchedEpisodeRepository(WatchedEpisodeRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_show(self, user_id: str, show_id: str) -> list[WatchedEpisode]:
        rows = await self._session.scalars(
            select(WatchedEpisodeRecord)
            .where(WatchedEpisodeRecord.user_id == user_id, WatchedEpisodeRecord.show_id == show_id)
            .order_by(WatchedEpisodeRecord.watched_at)
        )
        return [self._to_domain(row) for row in rows]

    async def mark(self, user_id: str, show_id: str, episode_id: str) -> WatchedEpisode:
        existing = await self._session.get(WatchedEpisodeRecord, (user_id, episode_id))
        if existing is not None:
            return self._to_domain(existing)
        record = WatchedEpisodeRecord(
            user_id=user_id, show_id=show_id, episode_id=episode_id, watched_at=utc_now()
        )
        self._session.add(record)
        try:
            await self._session.commit()
        except IntegrityError:
            # A concurrent request won the race; the desired state already holds.
            await self._session.rollback()
            winner = await self._session.get(WatchedEpisodeRecord, (user_id, episode_id))
            if winner is None:
                raise
            return self._to_domain(winner)
        return self._to_domain(record)

    async def unmark(self, user_id: str, episode_id: str) -> None:
        await self._session.execute(
            delete(WatchedEpisodeRecord).where(
                WatchedEpisodeRecord.user_id == user_id,
                WatchedEpisodeRecord.episode_id == episode_id,
            )
        )
        await self._session.commit()

    @staticmethod
    def _to_domain(record: WatchedEpisodeRecord) -> WatchedEpisode:
        return WatchedEpisode(
            show_id=record.show_id,
            episode_id=record.episode_id,
            watched_at=as_utc(record.watched_at),
        )
