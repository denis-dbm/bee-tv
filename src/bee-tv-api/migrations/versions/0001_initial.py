"""Initial schema: comments and watched episodes.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("author_name", sa.String(100), nullable=False),
        sa.Column("show_id", sa.String(64), nullable=False),
        sa.Column("episode_id", sa.String(64), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_comments_show_episode_created", "comments", ["show_id", "episode_id", "created_at"]
    )
    op.create_table(
        "watched_episodes",
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("episode_id", sa.String(64), primary_key=True),
        sa.Column("show_id", sa.String(64), nullable=False),
        sa.Column("watched_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_watched_episodes_user_show", "watched_episodes", ["user_id", "show_id"])


def downgrade() -> None:
    op.drop_index("ix_watched_episodes_user_show", table_name="watched_episodes")
    op.drop_table("watched_episodes")
    op.drop_index("ix_comments_show_episode_created", table_name="comments")
    op.drop_table("comments")
