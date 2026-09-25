"""Shared relational data model.

In Vertical Slice Architecture slices share the *data model*, never each other's code:
each slice owns its own queries/repositories over these tables.
"""

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, utc_now
from app.core.params import ID_LENGTH


class CommentRecord(Base):
    __tablename__ = "comments"
    __table_args__ = (
        Index("ix_comments_show_episode_created", "show_id", "episode_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), nullable=False)
    author_name: Mapped[str] = mapped_column(String(100), nullable=False)
    show_id: Mapped[str] = mapped_column(String(ID_LENGTH), nullable=False)
    episode_id: Mapped[str | None] = mapped_column(String(ID_LENGTH), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(), nullable=False, default=utc_now)


class WatchedEpisodeRecord(Base):
    __tablename__ = "watched_episodes"
    __table_args__ = (Index("ix_watched_episodes_user_show", "user_id", "show_id"),)

    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    episode_id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    show_id: Mapped[str] = mapped_column(String(ID_LENGTH), nullable=False)
    watched_at: Mapped[datetime] = mapped_column(DateTime(), nullable=False, default=utc_now)
