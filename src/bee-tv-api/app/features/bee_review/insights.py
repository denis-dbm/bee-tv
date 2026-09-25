"""Bee Review domain: what an insight is about, what it produces, and the generator port."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum


class SubjectKind(StrEnum):
    SERIES = "series"
    EPISODE = "episode"


class InsightSource(StrEnum):
    AI = "ai"
    FALLBACK = "fallback"


@dataclass(frozen=True, slots=True)
class InsightSubject:
    """Everything a generator may use. Hashable, so it doubles as a cache key."""

    kind: SubjectKind
    title: str
    summary: str
    genres: tuple[str, ...]
    series_title: str | None = None
    season: int | None = None
    number: int | None = None
    comments: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class Insight:
    text: str
    source: InsightSource
    generator: str


class InsightGenerationError(Exception):
    """A generator could not produce an insight (outage, quota, malformed output...)."""


class InsightGenerator(ABC):
    """Port for anything able to turn an `InsightSubject` into an `Insight`."""

    name: str

    @abstractmethod
    async def generate(self, subject: InsightSubject) -> Insight:
        """Raise `InsightGenerationError` when no insight can be produced."""
