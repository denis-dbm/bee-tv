"""Catalog port: the contract every TV catalog partner adapter must fulfil."""

from abc import ABC, abstractmethod

from app.core.errors import NotFoundError, ServiceUnavailableError
from app.integrations.catalog.models import Episode, Show, ShowSummary


class ShowNotFoundError(NotFoundError):
    code = "show_not_found"
    title = "TV series not found"


class EpisodeNotFoundError(NotFoundError):
    code = "episode_not_found"
    title = "Episode not found"


class CatalogUnavailableError(ServiceUnavailableError):
    code = "catalog_unavailable"
    title = "The TV catalog is temporarily unavailable"


class CatalogProvider(ABC):
    """Read-only access to a TV series catalog.

    Implementations raise `ShowNotFoundError` / `EpisodeNotFoundError` for unknown ids
    and `CatalogUnavailableError` for any partner outage.
    """

    @abstractmethod
    async def search_shows(self, query: str) -> list[ShowSummary]: ...

    @abstractmethod
    async def get_show(self, show_id: str) -> Show: ...

    @abstractmethod
    async def list_episodes(self, show_id: str) -> list[Episode]: ...

    @abstractmethod
    async def get_episode(self, show_id: str, episode_id: str) -> Episode: ...
