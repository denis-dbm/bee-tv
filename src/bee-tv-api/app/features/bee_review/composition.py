"""Generator decorators and the Bee Review composition root."""

import logging
import time
from collections.abc import Callable

import httpx
from cachetools import TTLCache

from app.core.config import Settings
from app.core.resilience import CircuitBreaker
from app.features.bee_review.insights import (
    Insight,
    InsightGenerator,
    InsightSource,
    InsightSubject,
)
from app.features.bee_review.llm import ChatCompletionInsightGenerator
from app.features.bee_review.prompting import PromptBuilder
from app.features.bee_review.rule_based import RuleBasedInsightGenerator

logger = logging.getLogger(__name__)


class FallbackInsightGenerator(InsightGenerator):
    """Chain of responsibility: try the primary, degrade gracefully to the fallback.

    Any primary failure (including unexpected bugs) is logged and absorbed: the user always
    gets an insight, and the response tells the UI which generator produced it.
    """

    def __init__(self, primary: InsightGenerator, fallback: InsightGenerator) -> None:
        self._primary = primary
        self._fallback = fallback
        self.name = f"{primary.name}|{fallback.name}"

    async def generate(self, subject: InsightSubject) -> Insight:
        try:
            return await self._primary.generate(subject)
        except Exception:
            logger.warning(
                "Insight generator %s failed; falling back to %s",
                self._primary.name,
                self._fallback.name,
                exc_info=True,
            )
        return await self._fallback.generate(subject)


class CachedInsightGenerator(InsightGenerator):
    """Caches AI insights per subject: saves free-tier quota and gives instant re-opens.
    Fallback insights are not cached, so the AI result shows up once the provider recovers."""

    def __init__(
        self,
        inner: InsightGenerator,
        ttl_seconds: float = 3600.0,
        max_entries: int = 512,
        timer: Callable[[], float] = time.monotonic,
    ) -> None:
        self._inner = inner
        self._cache: TTLCache[InsightSubject, Insight] = TTLCache(
            maxsize=max_entries, ttl=ttl_seconds, timer=timer
        )
        self.name = inner.name

    async def generate(self, subject: InsightSubject) -> Insight:
        cached = self._cache.get(subject)
        if cached is not None:
            return cached
        insight = await self._inner.generate(subject)
        if insight.source is InsightSource.AI:
            self._cache[subject] = insight
        return insight


def build_insight_http_client(settings: Settings) -> httpx.AsyncClient | None:
    if settings.insight_api_token is None:
        return None
    return httpx.AsyncClient(
        base_url=settings.insight_api_base_url,
        timeout=settings.insight_timeout_seconds,
        headers={"Authorization": f"Bearer {settings.insight_api_token.get_secret_value()}"},
    )


def build_insight_generator(
    settings: Settings, client: httpx.AsyncClient | None
) -> InsightGenerator:
    fallback = RuleBasedInsightGenerator()
    if client is None:
        logger.warning("No AI token configured: Bee Review runs on the rule-based generator only")
        return fallback
    llm = ChatCompletionInsightGenerator(
        client=client,
        model=settings.insight_model,
        breaker=CircuitBreaker(
            "insight-llm",
            failure_threshold=settings.circuit_breaker_failure_threshold,
            reset_timeout=settings.circuit_breaker_reset_seconds,
        ),
        prompt_builder=PromptBuilder(max_comments=settings.insight_max_comments),
    )
    logger.info("Bee Review uses %s with rule-based fallback", settings.insight_model)
    return FallbackInsightGenerator(
        CachedInsightGenerator(llm, ttl_seconds=settings.insight_cache_ttl_seconds), fallback
    )
