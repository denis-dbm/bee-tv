"""Common path parameters."""

from typing import Annotated

from fastapi import Path

ID_LENGTH = 64
_ID_PATTERN = r"^[A-Za-z0-9_-]+$"

ShowIdPath = Annotated[
    str, Path(min_length=1, max_length=ID_LENGTH, pattern=_ID_PATTERN, description="Series id")
]
EpisodeIdPath = Annotated[
    str, Path(min_length=1, max_length=ID_LENGTH, pattern=_ID_PATTERN, description="Episode id")
]
