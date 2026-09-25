"""In-memory test doubles for the application ports."""

from dataclasses import dataclass, field

from app.features.bee_review.insights import (
    Insight,
    InsightGenerationError,
    InsightGenerator,
    InsightSource,
    InsightSubject,
)
from app.integrations.catalog.models import Episode, Show, ShowSummary
from app.integrations.catalog.provider import (
    CatalogProvider,
    CatalogUnavailableError,
    EpisodeNotFoundError,
    ShowNotFoundError,
)

DARK = Show(
    id="17861",
    title="Dark",
    year=2017,
    poster_url="https://img/dark.jpg",
    summary="A family saga with a supernatural twist.",
    genres=("Drama", "Science-Fiction", "Supernatural"),
    status="Ended",
    language="German",
    network="Netflix",
    rating=8.2,
    premiered="2017-12-01",
    ended="2020-06-27",
)

DARK_EPISODES = (
    Episode(
        id="1", show_id="17861", season=1, number=1, title="Secrets", summary="A boy vanishes."
    ),
    Episode(id="2", show_id="17861", season=1, number=2, title="Lies", summary="Lies surface."),
    Episode(id="3", show_id="17861", season=2, number=1, title="Beginnings", summary="Time loops."),
)


@dataclass
class FakeCatalogProvider(CatalogProvider):
    shows: dict[str, Show] = field(default_factory=lambda: {DARK.id: DARK})
    episodes: dict[str, tuple[Episode, ...]] = field(
        default_factory=lambda: {DARK.id: DARK_EPISODES}
    )
    unavailable: bool = False
    calls: list[str] = field(default_factory=list)

    def _guard(self, call: str) -> None:
        self.calls.append(call)
        if self.unavailable:
            raise CatalogUnavailableError()

    async def search_shows(self, query: str) -> list[ShowSummary]:
        self._guard(f"search:{query}")
        return [
            ShowSummary(s.id, s.title, s.year, s.poster_url)
            for s in self.shows.values()
            if query.lower() in s.title.lower()
        ]

    async def get_show(self, show_id: str) -> Show:
        self._guard(f"show:{show_id}")
        try:
            return self.shows[show_id]
        except KeyError:
            raise ShowNotFoundError() from None

    async def list_episodes(self, show_id: str) -> list[Episode]:
        self._guard(f"episodes:{show_id}")
        if show_id not in self.shows:
            raise ShowNotFoundError()
        return list(self.episodes.get(show_id, ()))

    async def get_episode(self, show_id: str, episode_id: str) -> Episode:
        self._guard(f"episode:{show_id}:{episode_id}")
        for episode in self.episodes.get(show_id, ()):
            if episode.id == episode_id:
                return episode
        raise EpisodeNotFoundError()


@dataclass
class FakeInsightGenerator(InsightGenerator):
    name: str = "fake-llm"
    text: str = "A fake insight."
    source: InsightSource = InsightSource.AI
    fail: bool = False
    subjects: list[InsightSubject] = field(default_factory=list)

    async def generate(self, subject: InsightSubject) -> Insight:
        self.subjects.append(subject)
        if self.fail:
            raise InsightGenerationError("boom")
        return Insight(text=self.text, source=self.source, generator=self.name)
