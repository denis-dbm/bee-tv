"""Provider-agnostic catalog domain models.

These are Bee TV's own vocabulary. Partner payloads never leak past the adapter layer,
which keeps the rest of the application free of vendor lock-in.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ShowSummary:
    id: str
    title: str
    year: int | None
    poster_url: str | None


@dataclass(frozen=True, slots=True)
class Show:
    id: str
    title: str
    year: int | None
    poster_url: str | None
    summary: str
    genres: tuple[str, ...] = field(default_factory=tuple)
    status: str | None = None
    language: str | None = None
    network: str | None = None
    rating: float | None = None
    premiered: str | None = None
    ended: str | None = None


@dataclass(frozen=True, slots=True)
class Episode:
    id: str
    show_id: str
    season: int
    number: int | None
    title: str
    summary: str
    airdate: str | None = None
    runtime: int | None = None
    image_url: str | None = None
    rating: float | None = None
