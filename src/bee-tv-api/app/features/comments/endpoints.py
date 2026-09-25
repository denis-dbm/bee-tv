"""Feature: comments on a TV series or on one of its episodes."""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response, status
from pydantic import Field, field_validator

from app.core.db import SessionDep
from app.core.errors import NotFoundError
from app.core.identity import CurrentUserDep
from app.core.params import EpisodeIdPath, ShowIdPath
from app.core.schemas import ApiModel, Page
from app.features.comments.repository import (
    Comment,
    CommentRepository,
    NewComment,
    SqlCommentRepository,
)
from app.integrations.catalog.dependencies import CatalogDep

logger = logging.getLogger(__name__)

router = APIRouter(tags=["comments"])

MAX_COMMENT_LENGTH = 2000


def get_comment_repository(session: SessionDep) -> CommentRepository:
    return SqlCommentRepository(session)


RepositoryDep = Annotated[CommentRepository, Depends(get_comment_repository)]


class CreateCommentRequest(ApiModel):
    body: str = Field(min_length=1, max_length=MAX_COMMENT_LENGTH)

    @field_validator("body")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Comment must not be blank")
        return stripped


class CommentResponse(ApiModel):
    id: int
    show_id: str
    episode_id: str | None
    author_name: str
    body: str
    created_at: datetime

    @classmethod
    def from_domain(cls, comment: Comment) -> "CommentResponse":
        return cls(
            id=comment.id,
            show_id=comment.show_id,
            episode_id=comment.episode_id,
            author_name=comment.author_name,
            body=comment.body,
            created_at=comment.created_at,
        )


class CommentNotFoundError(NotFoundError):
    code = "comment_not_found"
    title = "Comment not found"


def comment_location(comment: Comment) -> str:
    return f"/api/v1/comments/{comment.id}"


class EpisodeCommentCount(ApiModel):
    episode_id: str
    count: int


@router.get(
    "/shows/{show_id}/comments",
    response_model=Page[CommentResponse],
    summary="List comments on a TV series",
)
async def list_show_comments(
    show_id: ShowIdPath, repository: RepositoryDep
) -> Page[CommentResponse]:
    comments = await repository.list_for(show_id, episode_id=None)
    return Page(items=[CommentResponse.from_domain(c) for c in comments])


@router.post(
    "/shows/{show_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Comment on a TV series",
)
async def create_show_comment(
    show_id: ShowIdPath,
    payload: CreateCommentRequest,
    response: Response,
    user: CurrentUserDep,
    repository: RepositoryDep,
    catalog: CatalogDep,
) -> CommentResponse:
    await catalog.get_show(show_id)
    comment = await repository.add(
        NewComment(user.id, user.display_name, show_id, episode_id=None, body=payload.body)
    )
    logger.info("User %s commented on show %s (comment %s)", user.id, show_id, comment.id)
    response.headers["Location"] = comment_location(comment)
    return CommentResponse.from_domain(comment)


@router.get(
    "/shows/{show_id}/episodes/comment-counts",
    response_model=Page[EpisodeCommentCount],
    summary="Count comments per episode of a TV series",
)
async def count_episode_comments(
    show_id: ShowIdPath, repository: RepositoryDep
) -> Page[EpisodeCommentCount]:
    counts = await repository.count_by_episode(show_id)
    return Page(
        items=[EpisodeCommentCount(episode_id=eid, count=n) for eid, n in sorted(counts.items())]
    )


@router.get(
    "/shows/{show_id}/episodes/{episode_id}/comments",
    response_model=Page[CommentResponse],
    summary="List comments on an episode",
)
async def list_episode_comments(
    show_id: ShowIdPath, episode_id: EpisodeIdPath, repository: RepositoryDep
) -> Page[CommentResponse]:
    comments = await repository.list_for(show_id, episode_id=episode_id)
    return Page(items=[CommentResponse.from_domain(c) for c in comments])


@router.post(
    "/shows/{show_id}/episodes/{episode_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Comment on an episode",
)
async def create_episode_comment(
    show_id: ShowIdPath,
    episode_id: EpisodeIdPath,
    payload: CreateCommentRequest,
    response: Response,
    user: CurrentUserDep,
    repository: RepositoryDep,
    catalog: CatalogDep,
) -> CommentResponse:
    await catalog.get_episode(show_id, episode_id)
    comment = await repository.add(
        NewComment(user.id, user.display_name, show_id, episode_id=episode_id, body=payload.body)
    )
    logger.info(
        "User %s commented on episode %s of show %s (comment %s)",
        user.id,
        episode_id,
        show_id,
        comment.id,
    )
    response.headers["Location"] = comment_location(comment)
    return CommentResponse.from_domain(comment)


@router.get("/comments/{comment_id}", response_model=CommentResponse, summary="Get a comment")
async def get_comment(
    comment_id: Annotated[int, Path(ge=1)], repository: RepositoryDep
) -> CommentResponse:
    comment = await repository.get(comment_id)
    if comment is None:
        raise CommentNotFoundError(f"Comment '{comment_id}' does not exist")
    return CommentResponse.from_domain(comment)
